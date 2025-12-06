/**
 * EASE Payment Router ABI
 * Contract for private payments using Railgun
 */
export const EASE_PAYMENT_ROUTER_ABI = [
  // Payment functions
  'function payForSession(string hostId, address token, uint256 amount, bytes32 sessionHash) returns (bytes32 receiptId)',
  'function payForSessionBNB(string hostId, bytes32 sessionHash) payable returns (bytes32 receiptId)',
  
  // Verification
  'function verifyPayment(bytes32 receiptId, string hostId, uint256 minAmount) view returns (bool)',
  'function verifyPaymentWithSession(bytes32 receiptId, string hostId, bytes32 sessionHash, uint256 minAmount) view returns (bool)',
  'function getReceipt(bytes32 receiptId) view returns (tuple(string hostId, address token, uint256 amount, bytes32 sessionHash, uint256 timestamp, bool isPrivate, address payer))',
  
  // Lookup
  'function getSplitForHost(string hostId) view returns (address)',
  'function factory() view returns (address)',
  'function totalPayments() view returns (uint256)',
  'function totalVolume() view returns (uint256)',
  
  // Events
  'event PaymentReceived(bytes32 indexed receiptId, string indexed hostId, address indexed token, uint256 amount, bytes32 sessionHash, bool isPrivate)',
];

