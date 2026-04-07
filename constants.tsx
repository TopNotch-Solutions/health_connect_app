export const syntelPartnerId = 'BCX';
export const syntelName = 'BCX01';
export const syntelSecurityKey = '78963957';
export const syntel_url =
  'http://biztalktest3.syntell.net/ElectricityVendingWS/WcfService_ElectricityVendingWS.svc';
export const bcx_base_url = 'http://41.182.255.20:8086';
export const dssp_localhost = 'http://localhost:3001';
export const payment = '/api/v2/onlinepayments/initiate';
export const consumer_key = 'Ag3K9S2YhiKqm8KQhjMngPRKUNsa';
export const consumer_secret = 'iR8rRJO4v5bWUnwVJt8LpFa_akka';
export const kmbaseurl = 'https://km.mtc.com.na';
export const adl_generate_access_token = 
  'https://api-gw.mtc.com.na/v1/km/auth/token';
export const api_timeout = 30000;
export const dpo_initiate_url =
  'https://secure.paygate.co.za/payweb3/initiate.trans';
export const dpo_redirect_url =
  'https://secure.paygate.co.za/payweb3/process.trans';
export const dpo_query_url = 'https://secure.paygate.co.za/payweb3/query.trans';
export const APP_VERSION = '1.0.6'
export const dpo_statuses = [
  {
    transaction_status: 1,
    result_code: 990017,
    message: 'Transaction Approved',
    status: true,
  },
  {
    transaction_status: 2,
    result_code: 900003,
    message: 'Insufficient Funds Transactions',
    status: false,
  },
  {
    transaction_status: 2,
    result_code: 900007,
    message: 'Declined Transactions',
    status: false,
  },
  {
    transaction_status: 0,
    result_code: 990022,
    message: 'Unprocessed Transactions',
    status: false,
  },
  {
    transaction_status: 2,
    result_code: 900004,
    message: 'Invalid Card Number',
    status: false,
  },
];

export const FONT_SIZES = {
  small: {
    largeText: 34,
    smallText: 12,
    text: 14,
    subHeading: 16,
    heading: 18,
    buttonText: 16,
    error: 12,
    largeHeading: 28,
  },
  medium: {
    largeText: 36,
    smallText: 14,
    text: 16,
    subHeading: 18,
    heading: 20,
    buttonText: 18,
    error: 14,
    largeHeading: 30,
  },
  large: {
    largeText: 38,
    smallText: 16,
    text: 18,
    subHeading: 20,
    heading: 22,
    buttonText: 20,
    error: 14,
    largeHeading: 32,
  },
};


// PROD
// export const dpo_paygate_id = '1050979100020';
// export const dpo_encryption_key = 'lxJiFCL8l4x6';
// export const adlbaseurl = 'https://api-gw.mtc.com.na/mdt-erongo/v1/uat';
// export const dssp_base_url = 'https://api.erongored.com.na';
// export const images_base_url = "https://api.erongored.com.na"
// export const socket_base_url = "api.erongored.com.na";

// UAT 
export const dpo_paygate_id = "1050979100012";
export const dpo_encryption_key = "EyLGXVfI9aRb";
export const adlbaseurl = 'https://uat-api.erongored.com.na/uat';
export const dssp_base_url = "https://uat-api.erongored.com.na";
export const images_base_url = "https://uat-api.erongored.com.na";
export const socket_base_url = "uat-api.erongored.com.na";