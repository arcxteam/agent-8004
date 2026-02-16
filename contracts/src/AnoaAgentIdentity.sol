// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AnoaAgentIdentity
 * @author ANOA Protocol Team
 * @notice ERC-8004 Identity Registry for Trustless AI Agents
 * @dev Implements the Identity Registry component of ERC-8004 specification
 * 
 * Key Features:
 * - ERC-721 NFT representing unique agent identity
 * - Portable identifiers across organizational boundaries
 * - On-chain metadata storage with IPFS/Arweave URIs
 * - Global identifier format: eip155:{chainId}:{registryAddr}+{tokenId}
 * - Operator delegation for agent wallets
 * - Cross-chain discovery support
 */
contract AnoaAgentIdentity is 
    ERC721,
    ERC721URIStorage,
    ERC721Enumerable,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    // ============================================
    // TYPE DECLARATIONS
    // ============================================
    
    /**
     * @notice Agent metadata structure following ERC-8004 spec
     * @param walletAddress The agent's operational wallet address
     * @param metadataUri IPFS/Arweave URI to Agent Registration JSON
     * @param registeredAt Block timestamp of registration
     * @param isActive Whether the agent is currently active
     * @param operator Address authorized to operate on behalf of owner
     * @param capabilities Bitmap of agent capabilities
     * @param version Registry version for upgrade compatibility
     */
    struct AgentInfo {
        address walletAddress;
        string metadataUri;
        uint256 registeredAt;
        bool isActive;
        address operator;
        uint256 capabilities;
        uint8 version;
    }

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Token ID counter (starts from 1)
    uint256 private _tokenIdCounter;
    
    /// @notice Registration fee in native token (MON)
    uint256 public registrationFee;
    
    /// @notice Protocol fee recipient
    address public feeRecipient;
    
    /// @notice Mapping from token ID to agent info
    mapping(uint256 => AgentInfo) private _agentInfo;
    
    /// @notice Mapping from wallet address to token ID
    mapping(address => uint256) public walletToAgent;
    
    /// @notice Mapping from handle (name) to token ID
    mapping(bytes32 => uint256) public handleToAgent;
    
    /// @notice Current registry version
    uint8 public constant REGISTRY_VERSION = 1;
    
    /// @notice Chain ID for global identifier
    uint256 public immutable chainId;

    // ============================================
    // EVENTS
    // ============================================
    
    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed walletAddress,
        address indexed owner,
        string handle,
        string metadataUri,
        uint256 timestamp
    );
    
    event AgentUpdated(
        uint256 indexed tokenId,
        string metadataUri,
        uint256 timestamp
    );
    
    event AgentDeactivated(
        uint256 indexed tokenId,
        uint256 timestamp
    );
    
    event AgentReactivated(
        uint256 indexed tokenId,
        uint256 timestamp
    );
    
    event OperatorSet(
        uint256 indexed tokenId,
        address indexed operator
    );
    
    event CapabilitiesUpdated(
        uint256 indexed tokenId,
        uint256 capabilities
    );
    
    event RegistrationFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );

    // ============================================
    // ERRORS
    // ============================================
    
    error InsufficientRegistrationFee(uint256 sent, uint256 required);
    error AgentAlreadyRegistered(address wallet);
    error HandleAlreadyTaken(bytes32 handle);
    error InvalidWalletAddress();
    error AgentNotFound(uint256 tokenId);
    error AgentNotActive(uint256 tokenId);
    error NotOwnerOrOperator(address caller, uint256 tokenId);
    error InvalidHandle();

    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwnerOrOperator(uint256 tokenId) {
        if (!_isOwnerOrOperator(msg.sender, tokenId)) {
            revert NotOwnerOrOperator(msg.sender, tokenId);
        }
        _;
    }
    
    modifier agentExists(uint256 tokenId) {
        if (_ownerOf(tokenId) == address(0)) {
            revert AgentNotFound(tokenId);
        }
        _;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the ANOA Agent Identity Registry
     * @param name_ NFT collection name
     * @param symbol_ NFT collection symbol
     * @param registrationFee_ Initial registration fee
     * @param feeRecipient_ Address to receive protocol fees
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 registrationFee_,
        address feeRecipient_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        registrationFee = registrationFee_;
        feeRecipient = feeRecipient_ != address(0) ? feeRecipient_ : msg.sender;
        chainId = block.chainid;
    }

    // ============================================
    // REGISTRATION FUNCTIONS
    // ============================================
    
    /**
     * @notice Register a new AI agent identity
     * @param agentWallet The wallet address the agent will use for operations
     * @param handle Unique human-readable identifier for the agent
     * @param metadataUri URI pointing to Agent Registration JSON
     * @param capabilities Initial capability bitmap
     * @return tokenId The newly minted token ID
     */
    function register(
        address agentWallet,
        string calldata handle,
        string calldata metadataUri,
        uint256 capabilities
    ) external payable nonReentrant whenNotPaused returns (uint256 tokenId) {
        // Validate payment
        if (msg.value < registrationFee) {
            revert InsufficientRegistrationFee(msg.value, registrationFee);
        }
        
        // Validate wallet
        if (agentWallet == address(0)) {
            revert InvalidWalletAddress();
        }
        
        if (walletToAgent[agentWallet] != 0) {
            revert AgentAlreadyRegistered(agentWallet);
        }
        
        // Validate handle
        bytes32 handleHash = keccak256(bytes(handle));
        if (bytes(handle).length == 0 || bytes(handle).length > 32) {
            revert InvalidHandle();
        }
        if (handleToAgent[handleHash] != 0) {
            revert HandleAlreadyTaken(handleHash);
        }
        
        // Mint NFT
        _tokenIdCounter++;
        tokenId = _tokenIdCounter;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataUri);
        
        // Store agent info
        _agentInfo[tokenId] = AgentInfo({
            walletAddress: agentWallet,
            metadataUri: metadataUri,
            registeredAt: block.timestamp,
            isActive: true,
            operator: msg.sender,
            capabilities: capabilities,
            version: REGISTRY_VERSION
        });
        
        // Update mappings
        walletToAgent[agentWallet] = tokenId;
        handleToAgent[handleHash] = tokenId;
        
        // Transfer fee to recipient
        if (registrationFee > 0) {
            (bool success,) = payable(feeRecipient).call{value: registrationFee}("");
            require(success, "Fee transfer failed");
        }
        
        // Refund excess
        if (msg.value > registrationFee) {
            (bool refundSuccess,) = payable(msg.sender).call{value: msg.value - registrationFee}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit AgentRegistered(
            tokenId,
            agentWallet,
            msg.sender,
            handle,
            metadataUri,
            block.timestamp
        );
    }

    // ============================================
    // METADATA MANAGEMENT
    // ============================================
    
    /**
     * @notice Update agent metadata URI
     * @param tokenId The agent token ID
     * @param newMetadataUri New metadata URI
     */
    function setMetadata(
        uint256 tokenId,
        string calldata newMetadataUri
    ) external agentExists(tokenId) onlyOwnerOrOperator(tokenId) {
        _setTokenURI(tokenId, newMetadataUri);
        _agentInfo[tokenId].metadataUri = newMetadataUri;
        
        emit AgentUpdated(tokenId, newMetadataUri, block.timestamp);
    }
    
    /**
     * @notice Update agent capabilities
     * @param tokenId The agent token ID
     * @param capabilities New capability bitmap
     */
    function setCapabilities(
        uint256 tokenId,
        uint256 capabilities
    ) external agentExists(tokenId) onlyOwnerOrOperator(tokenId) {
        _agentInfo[tokenId].capabilities = capabilities;
        
        emit CapabilitiesUpdated(tokenId, capabilities);
    }
    
    /**
     * @notice Set operator for agent
     * @param tokenId The agent token ID
     * @param operator New operator address
     */
    function setOperator(
        uint256 tokenId,
        address operator
    ) external agentExists(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Only owner can set operator");
        _agentInfo[tokenId].operator = operator;
        
        emit OperatorSet(tokenId, operator);
    }

    // ============================================
    // AGENT LIFECYCLE
    // ============================================
    
    /**
     * @notice Deactivate an agent
     * @param tokenId The agent token ID
     */
    function deactivate(
        uint256 tokenId
    ) external agentExists(tokenId) onlyOwnerOrOperator(tokenId) {
        _agentInfo[tokenId].isActive = false;
        
        emit AgentDeactivated(tokenId, block.timestamp);
    }
    
    /**
     * @notice Reactivate an agent
     * @param tokenId The agent token ID
     */
    function reactivate(
        uint256 tokenId
    ) external agentExists(tokenId) onlyOwnerOrOperator(tokenId) {
        _agentInfo[tokenId].isActive = true;
        
        emit AgentReactivated(tokenId, block.timestamp);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get agent metadata
     * @param tokenId The agent token ID
     * @return Agent information struct
     */
    function getMetadata(uint256 tokenId) external view agentExists(tokenId) returns (AgentInfo memory) {
        return _agentInfo[tokenId];
    }
    
    /**
     * @notice Check if agent is active
     * @param tokenId The agent token ID
     * @return True if agent is active
     */
    function isAgentActive(uint256 tokenId) external view agentExists(tokenId) returns (bool) {
        return _agentInfo[tokenId].isActive;
    }
    
    /**
     * @notice Get global identifier for agent
     * @param tokenId The agent token ID
     * @return Global identifier string (eip155:{chainId}:{addr}+{tokenId})
     */
    function getGlobalId(uint256 tokenId) external view agentExists(tokenId) returns (string memory) {
        return string(
            abi.encodePacked(
                "eip155:",
                _toString(chainId),
                ":",
                _toHexString(address(this)),
                "+",
                _toString(tokenId)
            )
        );
    }
    
    /**
     * @notice Get agent by wallet address
     * @param wallet The wallet address
     * @return tokenId The agent token ID (0 if not found)
     */
    function getAgentByWallet(address wallet) external view returns (uint256) {
        return walletToAgent[wallet];
    }
    
    /**
     * @notice Get total number of registered agents
     * @return Total count
     */
    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Update registration fee
     * @param newFee New registration fee
     */
    function setRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = registrationFee;
        registrationFee = newFee;
        
        emit RegistrationFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @notice Update fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }
    
    /**
     * @notice Pause registration
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause registration
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (only stuck funds)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Withdraw failed");
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function _isOwnerOrOperator(address account, uint256 tokenId) internal view returns (bool) {
        return ownerOf(tokenId) == account || _agentInfo[tokenId].operator == account;
    }
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";
        bytes memory hexChars = "0123456789abcdef";
        for (uint i = 0; i < 20; i++) {
            buffer[2 + i * 2] = hexChars[uint8(uint160(addr) >> (8 * (19 - i) + 4)) & 0xf];
            buffer[3 + i * 2] = hexChars[uint8(uint160(addr) >> (8 * (19 - i))) & 0xf];
        }
        return string(buffer);
    }

    // ============================================
    // OVERRIDES FOR ERC721 EXTENSIONS
    // ============================================
    
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
