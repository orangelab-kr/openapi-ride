import axios from 'axios';

export async function sendMessageWithMessageGateway(props: {
  phone: string;
  name: string;
  fields: any;
}): Promise<void> {
  const {
    MESSAGE_GATEWAY_URL,
    MESSAGE_GATEWAY_ACCESS_KEY_ID,
    MESSAGE_GATEWAY_SECRET_ACCESS_KEY,
  } = process.env;

  await axios.post(`${MESSAGE_GATEWAY_URL}/send`, props, {
    headers: {
      'X-MESSAGE-GATEWAY-ACCESS-KEY-ID': String(MESSAGE_GATEWAY_ACCESS_KEY_ID),
      'X-MESSAGE-GATEWAY-SECRET-ACCESS-KEY': String(
        MESSAGE_GATEWAY_SECRET_ACCESS_KEY
      ),
    },
  });
}
