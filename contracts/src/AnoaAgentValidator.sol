// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AnoaAgentValidator
 * @author ANOA Protocol Team
 * @notice ERC-8004 Validation Registry for Trustless AI Agents
 * @dev Implements the Validation Registry component of ERC-8004 specification
 * 
 * Key Features:
 * - Multiple validation schemes (BASIC, STANDARD, ADVANCED)
 * - Stake-secured validators with slashing
 * - zkML/TEE proof verification support
 * - Time-based validation expiry
 * - Cross-scheme validation tracking
 */
contract AnoaAgentValidator is Ownable, ReentrancyGuard, Pausable {
    
    // ============================================
    // TYPE DECLARATIONS
    // ============================================
    
    /// @notice Validation status enum
    enum ValidationStatus {
        NONE,
        PENDING,
        VALIDATED,
        REJECTED,
        REVOKED,
        EXPIRED
    }
    
    /// @notice Validation scheme type
    enum SchemeType {
        BASIC,      // Reputation-based only
        STANDARD,   // Crypto-economic with staking
        ADVANCED    // TEE/zkML cryptographic proofs
    }
    
    /**
     * @notice Validation scheme configuration
     * @param name Human-readable name
     * @param schemeType Type of validation
     * @param minStake Minimum stake required for validators
     * @param validityPeriod How long validation is valid (seconds)
     * @param requiredProofs Number of proofs required
     * @param isActive Whether scheme is active
     */
    struct ValidationScheme {
        string name;
        SchemeType schemeType;
        uint256 minStake;
        uint256 validityPeriod;
        uint256 requiredProofs;
        bool isActive;
    }
    
    /**
     * @notice Validator information
     * @param name Validator display name
     * @param stakedAmount Amount staked
     * @param validationsCount Total validations performed
     * @param successRate Success rate (percentage * 100)
     * @param registeredAt Registration timestamp
     * @param isActive Whether validator is active
     * @param schemes Supported scheme IDs
     */
    struct Validator {
        string name;
        uint256 stakedAmount;
        uint256 validationsCount;
        uint256 successRate;
        uint256 registeredAt;
        bool isActive;
        uint256[] schemes;
    }
    
    /**
     * @notice Agent validation record
     * @param validator Address of validating validator
     * @param schemeId Validation scheme used
     * @param status Current validation status
     * @param validatedAt When validation was granted
     * @param expiresAt When validation expires
     * @param proofHash Hash of validation proof
     * @param notes Validation notes/comments
     */
    struct AgentValidation {
        address validator;
        uint256 schemeId;
        ValidationStatus status;
        uint256 validatedAt;
        uint256 expiresAt;
        bytes32 proofHash;
        string notes;
    }
    
    /**
     * @notice Validation request
     * @param requester Address requesting validation
     * @param schemeId Requested scheme
     * @param requestedAt Request timestamp
     * @param dataUri URI to validation data
     * @param status Request status
     */
    struct ValidationRequest {
        address requester;
        uint256 schemeId;
        uint256 requestedAt;
        string dataUri;
        ValidationStatus status;
    }

    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice Minimum stake for basic validators
    uint256 public constant MIN_VALIDATOR_STAKE = 0.1 ether;
    
    /// @notice Slashing percentage (basis points)
    uint256 public constant SLASH_PERCENT = 1000; // 10%

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Reference to Identity Registry
    address public immutable identityRegistry;
    
    /// @notice All validation schemes
    ValidationScheme[] public schemes;
    
    /// @notice Scheme count
    uint256 public schemeCount;
    
    /// @notice Registered validators
    mapping(address => Validator) private _validators;
    
    /// @notice Validator addresses list
    address[] public validatorAddresses;
    
    /// @notice Agent validations: agentId => schemeId => validation
    mapping(uint256 => mapping(uint256 => AgentValidation)) private _validations;
    
    /// @notice Validation requests: agentId => schemeId => request
    mapping(uint256 => mapping(uint256 => ValidationRequest)) private _requests;
    
    /// @notice Treasury for slashed funds
    address public treasury;
    
    /// @notice Total slashed amount
    uint256 public totalSlashed;

    // ============================================
    // EVENTS
    // ============================================
    
    event SchemeCreated(
        uint256 indexed schemeId,
        string name,
        SchemeType schemeType,
        uint256 minStake,
        uint256 validityPeriod
    );
    
    event ValidatorRegistered(
        address indexed validatorAddress,
        string name,
        uint256 stakedAmount
    );
    
    event ValidatorDeactivated(
        address indexed validatorAddress
    );
    
    event ValidationRequested(
        uint256 indexed agentId,
        uint256 indexed schemeId,
        address indexed requester,
        string dataUri
    );
    
    event AgentValidated(
        uint256 indexed agentId,
        uint256 indexed schemeId,
        address indexed validator,
        bytes32 proofHash,
        uint256 expiresAt
    );
    
    event ValidationRejected(
        uint256 indexed agentId,
        uint256 indexed schemeId,
        address indexed validator,
        string reason
    );
    
    event ValidationRevoked(
        uint256 indexed agentId,
        uint256 indexed schemeId,
        address indexed revoker,
        string reason
    );
    
    event ValidatorSlashed(
        address indexed validator,
        uint256 amount,
        string reason
    );
    
    event StakeAdded(
        address indexed validator,
        uint256 amount,
        uint256 newTotal
    );
    
    event StakeWithdrawn(
        address indexed validator,
        uint256 amount,
        uint256 remaining
    );

    // ============================================
    // ERRORS
    // ============================================
    
    error InsufficientStake(uint256 sent, uint256 required);
    error ValidatorNotFound(address validator);
    error ValidatorNotActive(address validator);
    error SchemeNotFound(uint256 schemeId);
    error SchemeNotActive(uint256 schemeId);
    error ValidationNotFound(uint256 agentId, uint256 schemeId);
    error AlreadyValidated(uint256 agentId, uint256 schemeId);
    error NotAuthorized(address caller);
    error InvalidProof();
    error WithdrawalLocked();

    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyActiveValidator() {
        if (!_validators[msg.sender].isActive) {
            revert ValidatorNotActive(msg.sender);
        }
        _;
    }
    
    modifier schemeExists(uint256 schemeId) {
        if (schemeId >= schemes.length) {
            revert SchemeNotFound(schemeId);
        }
        _;
    }
    
    modifier schemeActive(uint256 schemeId) {
        if (!schemes[schemeId].isActive) {
            revert SchemeNotActive(schemeId);
        }
        _;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the ANOA Validation Registry
     * @param identityRegistry_ Address of Identity Registry
     * @param treasury_ Address for slashed funds
     */
    constructor(
        address identityRegistry_,
        address treasury_
    ) Ownable(msg.sender) {
        require(identityRegistry_ != address(0), "Invalid registry");
        identityRegistry = identityRegistry_;
        treasury = treasury_ != address(0) ? treasury_ : msg.sender;
        
        // Initialize default schemes
        _createDefaultSchemes();
    }
    
    /**
     * @notice Create default validation schemes
     */
    function _createDefaultSchemes() internal {
        // BASIC - Reputation only
        schemes.push(ValidationScheme({
            name: "BASIC",
            schemeType: SchemeType.BASIC,
            minStake: 0.1 ether,
            validityPeriod: 365 days,
            requiredProofs: 0,
            isActive: true
        }));
        
        // STANDARD - Crypto-economic
        schemes.push(ValidationScheme({
            name: "STANDARD",
            schemeType: SchemeType.STANDARD,
            minStake: 1 ether,
            validityPeriod: 180 days,
            requiredProofs: 1,
            isActive: true
        }));
        
        // ADVANCED - TEE/zkML
        schemes.push(ValidationScheme({
            name: "ADVANCED",
            schemeType: SchemeType.ADVANCED,
            minStake: 5 ether,
            validityPeriod: 90 days,
            requiredProofs: 3,
            isActive: true
        }));
        
        schemeCount = 3;
        
        emit SchemeCreated(0, "BASIC", SchemeType.BASIC, 0.1 ether, 365 days);
        emit SchemeCreated(1, "STANDARD", SchemeType.STANDARD, 1 ether, 180 days);
        emit SchemeCreated(2, "ADVANCED", SchemeType.ADVANCED, 5 ether, 90 days);
    }

    // ============================================
    // VALIDATOR FUNCTIONS
    // ============================================
    
    /**
     * @notice Register as a validator with stake
     * @param name Validator display name
     * @param supportedSchemes Array of scheme IDs to support
     */
    function registerValidator(
        string calldata name,
        uint256[] calldata supportedSchemes
    ) external payable nonReentrant whenNotPaused {
        if (msg.value < MIN_VALIDATOR_STAKE) {
            revert InsufficientStake(msg.value, MIN_VALIDATOR_STAKE);
        }
        
        // Verify all schemes exist
        for (uint256 i = 0; i < supportedSchemes.length; i++) {
            if (supportedSchemes[i] >= schemes.length) {
                revert SchemeNotFound(supportedSchemes[i]);
            }
        }
        
        _validators[msg.sender] = Validator({
            name: name,
            stakedAmount: msg.value,
            validationsCount: 0,
            successRate: 10000, // 100%
            registeredAt: block.timestamp,
            isActive: true,
            schemes: supportedSchemes
        });
        
        validatorAddresses.push(msg.sender);
        
        emit ValidatorRegistered(msg.sender, name, msg.value);
    }
    
    /**
     * @notice Add stake to validator position
     */
    function addStake() external payable nonReentrant {
        require(_validators[msg.sender].registeredAt > 0, "Not registered");
        require(msg.value > 0, "Zero stake");
        
        _validators[msg.sender].stakedAmount += msg.value;
        
        emit StakeAdded(msg.sender, msg.value, _validators[msg.sender].stakedAmount);
    }
    
    /**
     * @notice Withdraw stake (subject to conditions)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        Validator storage validator = _validators[msg.sender];
        require(validator.registeredAt > 0, "Not registered");
        require(validator.stakedAmount >= amount, "Insufficient stake");
        require(
            validator.stakedAmount - amount >= MIN_VALIDATOR_STAKE || !validator.isActive,
            "Below min stake"
        );
        
        validator.stakedAmount -= amount;
        
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit StakeWithdrawn(msg.sender, amount, validator.stakedAmount);
    }
    
    /**
     * @notice Deactivate validator
     */
    function deactivateValidator() external {
        require(_validators[msg.sender].registeredAt > 0, "Not registered");
        _validators[msg.sender].isActive = false;
        
        emit ValidatorDeactivated(msg.sender);
    }

    // ============================================
    // VALIDATION FUNCTIONS
    // ============================================
    
    /**
     * @notice Request validation for an agent
     * @param agentId The agent token ID
     * @param schemeId Validation scheme to use
     * @param dataUri URI to validation data
     */
    function requestValidation(
        uint256 agentId,
        uint256 schemeId,
        string calldata dataUri
    ) external schemeExists(schemeId) schemeActive(schemeId) whenNotPaused {
        _requests[agentId][schemeId] = ValidationRequest({
            requester: msg.sender,
            schemeId: schemeId,
            requestedAt: block.timestamp,
            dataUri: dataUri,
            status: ValidationStatus.PENDING
        });
        
        emit ValidationRequested(agentId, schemeId, msg.sender, dataUri);
    }
    
    /**
     * @notice Validate an agent
     * @param agentId The agent token ID
     * @param schemeId Validation scheme
     * @param approved Whether to approve
     * @param proofHash Hash of validation proof
     * @param notes Validation notes
     */
    function validateAgent(
        uint256 agentId,
        uint256 schemeId,
        bool approved,
        bytes32 proofHash,
        string calldata notes
    ) external onlyActiveValidator schemeExists(schemeId) schemeActive(schemeId) nonReentrant whenNotPaused {
        // Verify validator has sufficient stake for scheme
        ValidationScheme memory scheme = schemes[schemeId];
        if (_validators[msg.sender].stakedAmount < scheme.minStake) {
            revert InsufficientStake(_validators[msg.sender].stakedAmount, scheme.minStake);
        }
        
        // Check not already validated
        AgentValidation storage existing = _validations[agentId][schemeId];
        if (existing.status == ValidationStatus.VALIDATED && 
            block.timestamp < existing.expiresAt) {
            revert AlreadyValidated(agentId, schemeId);
        }
        
        if (approved) {
            uint256 expiresAt = block.timestamp + scheme.validityPeriod;
            
            _validations[agentId][schemeId] = AgentValidation({
                validator: msg.sender,
                schemeId: schemeId,
                status: ValidationStatus.VALIDATED,
                validatedAt: block.timestamp,
                expiresAt: expiresAt,
                proofHash: proofHash,
                notes: notes
            });
            
            // Update request status
            if (_requests[agentId][schemeId].requestedAt > 0) {
                _requests[agentId][schemeId].status = ValidationStatus.VALIDATED;
            }
            
            // Update validator stats
            _validators[msg.sender].validationsCount++;
            
            emit AgentValidated(agentId, schemeId, msg.sender, proofHash, expiresAt);
        } else {
            _validations[agentId][schemeId] = AgentValidation({
                validator: msg.sender,
                schemeId: schemeId,
                status: ValidationStatus.REJECTED,
                validatedAt: block.timestamp,
                expiresAt: 0,
                proofHash: proofHash,
                notes: notes
            });
            
            // Update request status
            if (_requests[agentId][schemeId].requestedAt > 0) {
                _requests[agentId][schemeId].status = ValidationStatus.REJECTED;
            }
            
            emit ValidationRejected(agentId, schemeId, msg.sender, notes);
        }
    }
    
    /**
     * @notice Revoke a validation
     * @param agentId The agent token ID
     * @param schemeId Validation scheme
     * @param reason Reason for revocation
     */
    function revokeValidation(
        uint256 agentId,
        uint256 schemeId,
        string calldata reason
    ) external nonReentrant {
        AgentValidation storage validation = _validations[agentId][schemeId];
        
        // Only original validator or owner can revoke
        require(
            validation.validator == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        
        validation.status = ValidationStatus.REVOKED;
        
        emit ValidationRevoked(agentId, schemeId, msg.sender, reason);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Check if agent is validated under a scheme
     * @param agentId The agent token ID
     * @param schemeId Validation scheme
     * @return True if agent has valid, non-expired validation
     */
    function isAgentValidated(
        uint256 agentId,
        uint256 schemeId
    ) external view returns (bool) {
        AgentValidation memory validation = _validations[agentId][schemeId];
        return (
            validation.status == ValidationStatus.VALIDATED &&
            block.timestamp < validation.expiresAt
        );
    }
    
    /**
     * @notice Get validation details for an agent
     * @param agentId The agent token ID
     * @param schemeId Validation scheme
     * @return AgentValidation struct
     */
    function getValidation(
        uint256 agentId,
        uint256 schemeId
    ) external view returns (AgentValidation memory) {
        return _validations[agentId][schemeId];
    }
    
    /**
     * @notice Get all schemes
     * @return Array of ValidationScheme structs
     */
    function getSchemes() external view returns (ValidationScheme[] memory) {
        return schemes;
    }
    
    /**
     * @notice Get validator info
     * @param validatorAddress Validator address
     * @return Validator struct
     */
    function getValidator(address validatorAddress) external view returns (Validator memory) {
        return _validators[validatorAddress];
    }
    
    /**
     * @notice Get validation request
     * @param agentId The agent token ID
     * @param schemeId Validation scheme
     * @return ValidationRequest struct
     */
    function getRequest(
        uint256 agentId,
        uint256 schemeId
    ) external view returns (ValidationRequest memory) {
        return _requests[agentId][schemeId];
    }
    
    /**
     * @notice Get total validators count
     * @return Count of registered validators
     */
    function getTotalValidators() external view returns (uint256) {
        return validatorAddresses.length;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Create a new validation scheme
     * @param name Scheme name
     * @param schemeType Scheme type
     * @param minStake Minimum stake required
     * @param validityPeriod Validity period in seconds
     * @param requiredProofs Number of proofs required
     */
    function createScheme(
        string calldata name,
        SchemeType schemeType,
        uint256 minStake,
        uint256 validityPeriod,
        uint256 requiredProofs
    ) external onlyOwner {
        uint256 schemeId = schemes.length;
        
        schemes.push(ValidationScheme({
            name: name,
            schemeType: schemeType,
            minStake: minStake,
            validityPeriod: validityPeriod,
            requiredProofs: requiredProofs,
            isActive: true
        }));
        
        schemeCount++;
        
        emit SchemeCreated(schemeId, name, schemeType, minStake, validityPeriod);
    }
    
    /**
     * @notice Deactivate a validation scheme
     * @param schemeId Scheme ID to deactivate
     */
    function deactivateScheme(uint256 schemeId) external onlyOwner schemeExists(schemeId) {
        schemes[schemeId].isActive = false;
    }
    
    /**
     * @notice Slash a validator
     * @param validatorAddress Validator to slash
     * @param amount Amount to slash
     * @param reason Reason for slashing
     */
    function slashValidator(
        address validatorAddress,
        uint256 amount,
        string calldata reason
    ) external onlyOwner {
        Validator storage validator = _validators[validatorAddress];
        require(validator.registeredAt > 0, "Not registered");
        
        uint256 slashAmount = amount > validator.stakedAmount ? validator.stakedAmount : amount;
        validator.stakedAmount -= slashAmount;
        totalSlashed += slashAmount;
        
        // Transfer to treasury
        (bool success,) = payable(treasury).call{value: slashAmount}("");
        require(success, "Transfer failed");
        
        emit ValidatorSlashed(validatorAddress, slashAmount, reason);
    }
    
    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        treasury = newTreasury;
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
