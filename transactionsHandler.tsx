import axios from 'axios';
import { adlbaseurl,payment,consumer_key,consumer_secret,kmbaseurl, dpo_encryption_key,dpo_initiate_url,dpo_paygate_id, dpo_query_url, api_timeout } from './constants';
import CryptoJS from 'crypto-js';

  const getDPODate = async() => {

      const date = new Date();

  const year = date.getFullYear();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${day}-${month} ${hours}:${minutes}:${seconds}`;
};
export const processCardPayment = async (
  ref: string,
  amount: number,
  emailAddress: string,
  options?: {
    returnUrl?: string;
  },
) => {
  let success: any = null;

  const payGateId = dpo_paygate_id.toString();
  const reference = ref;
  const purchaseAmount = amount; // in cents, if required by DPO
  const currency = 'NAD';
  const returnUrl = options?.returnUrl || 'https://erongored.com';
  const transactionDate = await getDPODate(); // follow DPO format exactly
  const locale = 'en-za';
  const country = 'NAM';
  const email = emailAddress;
  const encryptionKey = dpo_encryption_key.toString();

  const hashString =
    payGateId +
    reference +
    amount +
    currency +
    returnUrl +
    transactionDate +
    locale +
    country +
    email +
    encryptionKey;

  const checksum = CryptoJS.MD5(hashString).toString();

  const formData = new URLSearchParams();
  formData.append('PAYGATE_ID', payGateId);
  formData.append('REFERENCE', reference);
  formData.append('AMOUNT', purchaseAmount.toString());
  formData.append('CURRENCY', currency);
  formData.append('RETURN_URL', returnUrl);
  formData.append('TRANSACTION_DATE', transactionDate);
  formData.append('LOCALE', locale);
  formData.append('COUNTRY', country);
  formData.append('EMAIL', email);

  formData.append('ENCRYPTION_KEY', encryptionKey);
  formData.append('CHECKSUM', checksum);

  try {
    await axios
      .post(dpo_initiate_url, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: api_timeout,
      })
      .then(res => {

        if (res.data) {
          const data = res.data;

          if (data.includes('PAYGATE_ID')) {
            const newValue = data.split('&');
            const payID = newValue[1].split('=')[1];
            const checksum = newValue[3].split('=')[1];

            success = {
              success: true,
              pay_id: payID,
              checksum: checksum,
            };
          } else {

            success = {
              success: false,
            };

          }
        } else {
          success = {
            success: false,
          };
        }
      })
      .catch(err => {
        console.log('dpo error' + err);

        success = {
          success: false,
        };
      });
  } catch (error) {
    success = {
      success: false,
    };
  }

  return success;
};

export const validateCardPayment = async (
  pay_request_id: string,
  ref: string,
  checksum: string,
) => {
  let success: any = null;

  const formData = new URLSearchParams();
  formData.append('PAYGATE_ID', dpo_paygate_id.toString());
  formData.append('PAY_REQUEST_ID', pay_request_id.toString());
  formData.append('REFERENCE', ref);
  formData.append('CHECKSUM', checksum);

  try {
    await axios
      .post(dpo_query_url, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: api_timeout,
      })
      .then(res => {
        if (res.data) {
          const data = res.data;

            if(data.includes('PAYGATE_ID')) {

              const newValue = data.split('&');
           
              const PAYGATE_ID = newValue[0].split('=')[1]
              const PAY_REQUEST_ID = newValue[1].split('=')[1]
              const RESULT_CODE = newValue[4].split('=')[1]
              const TRANSACTION_STATUS = newValue[3].split('=')[1]
              const checksum = newValue[13].split('=')[1]

              success = {
                "success" : true,
                "PAYGATE_ID" : PAYGATE_ID,
                "PAY_REQUEST_ID" : PAY_REQUEST_ID,
                "RESULT_CODE" : RESULT_CODE,
                "TRANSACTION_STATUS": TRANSACTION_STATUS,
                "checksum" : checksum
              }

            } else {

              success = {
                "success" : false
              }

            }
          }
      }).catch((err) => {

        success = {
          "success" : false

        }

      })


  } catch (error) {
    success = {
      success: false,
    };
  }

  return success;
};

/*otprequest*/
const createADLAccessToken = async (): Promise<any> => {
  let data: any = null;

  try {
    // Encode credentials in Base64
    const authHeader = btoa(`${consumer_key}:${consumer_secret}`);

    const headers = {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const search = {
      grant_type: 'client_credentials',
    };

    await axios({
      timeout: api_timeout,
      url: `${kmbaseurl}/oauth2/token`,
      data: search,
      method: 'post',
      headers: headers,
    })
      .then(res => {
        console.log(res);

        data = res;
      })
      .catch(err => {
        console.log(JSON.stringify(err));

        data = null;
      });
  } catch (error) {
    return null;
  }

  return data;
};

const getADLAccessToken = async () => {
  try {
    const res = await createADLAccessToken();

    if (res && res.data.access_token) {
      return res.data.access_token;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};
