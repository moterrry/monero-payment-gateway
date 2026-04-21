const QRCode = require('qrcode');

const generatePaymentQR = async (invoice) => {
  const paymentUri = `monero:${invoice.subaddress}?amount=${invoice.amount}&label=Invoice-${invoice.id}`;

  const qrDataUrl = await QRCode.toDataURL(paymentUri, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return qrDataUrl;
};

const generatePaymentQRBuffer = async (invoice) => {
  const paymentUri = `monero:${invoice.subaddress}?amount=${invoice.amount}&label=Invoice-${invoice.id}`;

  const buffer = await QRCode.toBuffer(paymentUri, {
    width: 300,
    margin: 2,
    type: 'png'
  });

  return buffer;
};

module.exports = {
  generatePaymentQR,
  generatePaymentQRBuffer
};
