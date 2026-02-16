// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AnoaAgentReputation
 * @author ANOA Protocol Team
 * @notice ERC-8004 Reputation Registry for Trustless AI Agents
 * @dev Implements the Reputation Registry component of ERC-8004 specification
 * 
 * Key Features:
 * - Feedback aggregation from client interactions
 * - Validator-weighted scoring system
 * - Tag-based categorization (FAST_EXECUTION, PROFITABLE, etc.)
 * - On-chain proof hashes for verification
 * - Trust score calculation with minimum feedback requirements
 * - Anti-sybil cooldown mechanism
 */
contract AnoaAgentReputation is Ownable, ReentrancyGuard, Pausable {
    
    // ============================================
    // TYPE DECLARATIONS
    // ============================================
    
    /**
     * @notice Individual feedback entry
     * @param clientAddress Address that gave the feedback
     * @param score Score given (0-100)
     * @param tag1 Primary category tag
     * @param tag2 Secondary category tag
     * @param proofHash IPFS/Arweave hash of proof data
     * @param timestamp When feedback was given
     * @param validatorWeight Weight if from validator (0 for regular)
     */
    struct Feedback {
        address clientAddress;
        uint8 score;
        bytes32 tag1;
        bytes32 tag2;
        bytes32 proofHash;
        uint256 timestamp;
        uint256 validatorWeight;
    }
    
    /**
     * @notice Aggregated reputation summary
     * @param totalFeedbacks Total number of feedbacks received
     * @param averageScore Weighted average score (scaled by 100)
     * @param lastFeedbackAt Timestamp of last feedback
     * @param totalValidatorFeedbacks Number of validator feedbacks
     * @param validatorScoreSum Sum of validator-weighted scores
     */
    struct ReputationSummary {
        uint256 totalFeedbacks;
        uint256 averageScore;
        uint256 lastFeedbackAt;
        uint256 totalValidatorFeedbacks;
        uint256 validatorScoreSum;
    }

    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice Maximum score value
    uint8 public constant MAX_SCORE = 100;
    
    /// @notice Minimum feedbacks for trust score calculation
    uint256 public constant MIN_FEEDBACKS_FOR_TRUST = 5;
    
    /// @notice Cooldown between feedbacks from same address (in seconds)
    uint256 public constant FEEDBACK_COOLDOWN = 1 hours;
    
    /// @notice Score precision multiplier (for decimal accuracy)
    uint256 public constant SCORE_PRECISION = 100;
    
    /// @notice Default validator weight
    uint256 public constant DEFAULT_VALIDATOR_WEIGHT = 3;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Reference to Identity Registry
    address public immutable identityRegistry;
    
    /// @notice All feedbacks by agent ID
    mapping(uint256 => Feedback[]) private _feedbacks;
    
    /// @notice Reputation summary by agent ID
    mapping(uint256 => ReputationSummary) private _summaries;
    
    /// @notice Tag counts by agent ID
    mapping(uint256 => mapping(bytes32 => uint256)) public tagCounts;
    
    /// @notice Last feedback time by client and agent
    mapping(address => mapping(uint256 => uint256)) public lastFeedbackTime;
    
    /// @notice Registered validators
    mapping(address => bool) public isValidator;
    
    /// @notice Validator weights
    mapping(address => uint256) public validatorWeight;
    
    /// @notice Total validators count
    uint256 public totalValidators;

    // ============================================
    // EVENTS
    // ============================================
    
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        bytes32 proofHash,
        uint256 timestamp
    );
    
    event ValidatorFeedbackGiven(
        uint256 indexed agentId,
        address indexed validatorAddress,
        uint8 score,
        uint256 weight,
        bytes32 proofHash,
        uint256 timestamp
    );
    
    event ValidatorRegistered(
        address indexed validatorAddress,
        uint256 weight
    );
    
    event ValidatorRemoved(
        address indexed validatorAddress
    );
    
    event ValidatorWeightUpdated(
        address indexed validatorAddress,
        uint256 oldWeight,
        uint256 newWeight
    );

    // ============================================
    // ERRORS
    // ============================================
    
    error InvalidScore(uint8 score);
    error AgentDoesNotExist(uint256 agentId);
    error FeedbackCooldownNotMet(uint256 timeRemaining);
    error NotValidator(address caller);
    error AlreadyValidator(address validator);
    error InsufficientFeedbacks(uint256 current, uint256 required);

    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier validScore(uint8 score) {
        if (score > MAX_SCORE) {
            revert InvalidScore(score);
        }
        _;
    }
    
    modifier onlyValidator() {
        if (!isValidator[msg.sender]) {
            revert NotValidator(msg.sender);
        }
        _;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the ANOA Reputation Registry
     * @param identityRegistry_ Address of the Identity Registry contract
     */
    constructor(address identityRegistry_) Ownable(msg.sender) {
        require(identityRegistry_ != address(0), "Invalid registry");
        identityRegistry = identityRegistry_;
    }

    // ============================================
    // FEEDBACK FUNCTIONS
    // ============================================
    
    /**
     * @notice Give feedback to an agent as a regular client
     * @param agentId The agent token ID
     * @param score Score from 0-100
     * @param tag1 Primary tag (e.g., keccak256("FAST_EXECUTION"))
     * @param tag2 Secondary tag (e.g., keccak256("PROFITABLE"))
     * @param proofHash Hash of proof data stored off-chain
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        bytes32 proofHash
    ) external nonReentrant whenNotPaused validScore(score) {
        // Check cooldown (skip for first-time feedback)
        uint256 lastTime = lastFeedbackTime[msg.sender][agentId];
        if (lastTime != 0 && block.timestamp < lastTime + FEEDBACK_COOLDOWN) {
            revert FeedbackCooldownNotMet(lastTime + FEEDBACK_COOLDOWN - block.timestamp);
        }
        
        // Create feedback entry
        Feedback memory feedback = Feedback({
            clientAddress: msg.sender,
            score: score,
            tag1: tag1,
            tag2: tag2,
            proofHash: proofHash,
            timestamp: block.timestamp,
            validatorWeight: 0
        });
        
        // Store feedback
        _feedbacks[agentId].push(feedback);
        
        // Update summary
        _updateSummary(agentId, score, 1);
        
        // Update tag counts
        if (tag1 != bytes32(0)) {
            tagCounts[agentId][tag1]++;
        }
        if (tag2 != bytes32(0)) {
            tagCounts[agentId][tag2]++;
        }
        
        // Update last feedback time
        lastFeedbackTime[msg.sender][agentId] = block.timestamp;
        
        emit FeedbackGiven(
            agentId,
            msg.sender,
            score,
            tag1,
            tag2,
            proofHash,
            block.timestamp
        );
    }
    
    /**
     * @notice Give weighted feedback as a registered validator
     * @param agentId The agent token ID
     * @param score Score from 0-100
     * @param proofHash Hash of validation proof
     */
    function giveValidatorFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 proofHash
    ) external nonReentrant whenNotPaused onlyValidator validScore(score) {
        uint256 weight = validatorWeight[msg.sender];
        if (weight == 0) weight = DEFAULT_VALIDATOR_WEIGHT;
        
        // Create feedback entry
        Feedback memory feedback = Feedback({
            clientAddress: msg.sender,
            score: score,
            tag1: bytes32(0),
            tag2: bytes32(0),
            proofHash: proofHash,
            timestamp: block.timestamp,
            validatorWeight: weight
        });
        
        // Store feedback
        _feedbacks[agentId].push(feedback);
        
        // Update summary with weight
        _updateSummary(agentId, score, weight);
        
        // Update validator-specific stats
        ReputationSummary storage summary = _summaries[agentId];
        summary.totalValidatorFeedbacks++;
        summary.validatorScoreSum += uint256(score) * weight;
        
        emit ValidatorFeedbackGiven(
            agentId,
            msg.sender,
            score,
            weight,
            proofHash,
            block.timestamp
        );
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get reputation summary for an agent
     * @param agentId The agent token ID
     * @return totalFeedbacks Total feedback count
     * @return averageScore Weighted average (scaled by SCORE_PRECISION)
     * @return lastFeedbackAt Last feedback timestamp
     */
    function getSummary(uint256 agentId) external view returns (
        uint256 totalFeedbacks,
        uint256 averageScore,
        uint256 lastFeedbackAt
    ) {
        ReputationSummary memory summary = _summaries[agentId];
        return (summary.totalFeedbacks, summary.averageScore, summary.lastFeedbackAt);
    }
    
    /**
     * @notice Get full reputation summary
     * @param agentId The agent token ID
     * @return Full ReputationSummary struct
     */
    function getFullSummary(uint256 agentId) external view returns (ReputationSummary memory) {
        return _summaries[agentId];
    }
    
    /**
     * @notice Calculate trust score for an agent
     * @dev Returns 0 if minimum feedbacks not met
     * @param agentId The agent token ID
     * @return Trust score (0-100, or 0 if insufficient feedbacks)
     */
    function getTrustScore(uint256 agentId) external view returns (uint256) {
        ReputationSummary memory summary = _summaries[agentId];
        
        if (summary.totalFeedbacks < MIN_FEEDBACKS_FOR_TRUST) {
            return 0;
        }
        
        // Calculate weighted trust score
        // Validator feedbacks have higher weight
        if (summary.totalValidatorFeedbacks > 0) {
            // Blend client average and validator average
            uint256 clientScore = summary.averageScore / SCORE_PRECISION;
            uint256 validatorScore = summary.validatorScoreSum / summary.totalValidatorFeedbacks;
            
            // Validators contribute 60%, clients 40%
            return (validatorScore * 60 + clientScore * 40) / 100;
        }
        
        return summary.averageScore / SCORE_PRECISION;
    }
    
    /**
     * @notice Check if agent meets minimum reputation threshold
     * @param agentId The agent token ID
     * @param minScore Minimum required score
     * @return True if agent meets threshold
     */
    function hasMinimumReputation(
        uint256 agentId,
        uint256 minScore
    ) external view returns (bool) {
        ReputationSummary memory summary = _summaries[agentId];
        
        if (summary.totalFeedbacks < MIN_FEEDBACKS_FOR_TRUST) {
            return false;
        }
        
        return summary.averageScore / SCORE_PRECISION >= minScore;
    }
    
    /**
     * @notice Get all feedbacks for an agent
     * @param agentId The agent token ID
     * @return Array of Feedback structs
     */
    function getFeedbacks(uint256 agentId) external view returns (Feedback[] memory) {
        return _feedbacks[agentId];
    }
    
    /**
     * @notice Get feedback count for an agent
     * @param agentId The agent token ID
     * @return Number of feedbacks
     */
    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return _feedbacks[agentId].length;
    }
    
    /**
     * @notice Get tag count for an agent
     * @param agentId The agent token ID
     * @param tag The tag to query
     * @return Count of feedbacks with this tag
     */
    function getTagCount(uint256 agentId, bytes32 tag) external view returns (uint256) {
        return tagCounts[agentId][tag];
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Register a new validator
     * @param validatorAddress Address to register as validator
     * @param weight Validator's weight multiplier
     */
    function registerValidator(
        address validatorAddress,
        uint256 weight
    ) external onlyOwner {
        if (isValidator[validatorAddress]) {
            revert AlreadyValidator(validatorAddress);
        }
        
        isValidator[validatorAddress] = true;
        validatorWeight[validatorAddress] = weight > 0 ? weight : DEFAULT_VALIDATOR_WEIGHT;
        totalValidators++;
        
        emit ValidatorRegistered(validatorAddress, validatorWeight[validatorAddress]);
    }
    
    /**
     * @notice Remove a validator
     * @param validatorAddress Address to remove
     */
    function removeValidator(address validatorAddress) external onlyOwner {
        if (!isValidator[validatorAddress]) {
            revert NotValidator(validatorAddress);
        }
        
        isValidator[validatorAddress] = false;
        validatorWeight[validatorAddress] = 0;
        totalValidators--;
        
        emit ValidatorRemoved(validatorAddress);
    }
    
    /**
     * @notice Update validator weight
     * @param validatorAddress Validator address
     * @param newWeight New weight value
     */
    function updateValidatorWeight(
        address validatorAddress,
        uint256 newWeight
    ) external onlyOwner {
        if (!isValidator[validatorAddress]) {
            revert NotValidator(validatorAddress);
        }
        
        uint256 oldWeight = validatorWeight[validatorAddress];
        validatorWeight[validatorAddress] = newWeight;
        
        emit ValidatorWeightUpdated(validatorAddress, oldWeight, newWeight);
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

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Update reputation summary with new feedback
     * @param agentId The agent token ID
     * @param score New score
     * @param weight Weight of this feedback
     */
    function _updateSummary(
        uint256 agentId,
        uint8 score,
        uint256 weight
    ) internal {
        ReputationSummary storage summary = _summaries[agentId];
        
        // Calculate new weighted average
        uint256 totalWeight = summary.totalFeedbacks + weight;
        uint256 newAverage = (
            summary.averageScore * summary.totalFeedbacks + 
            uint256(score) * SCORE_PRECISION * weight
        ) / totalWeight;
        
        summary.averageScore = newAverage;
        summary.totalFeedbacks = totalWeight;
        summary.lastFeedbackAt = block.timestamp;
    }
}
