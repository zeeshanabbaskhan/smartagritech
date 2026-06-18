// Gmail / SES SMTP transporter (P-55)

const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport(
  process.env.SMTP_HOST
    ? {
        host:   process.env.SMTP_HOST,
        port:   parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        pool:   true,
        maxConnections: parseInt(process.env.SMTP_POOL_MAX || '3', 10),
        auth: {
          user: process.env.SMTP_USER || process.env.NODEMAILER_USER,
          pass: process.env.SMTP_PASS || process.env.NODEMAILER_PASS,
        },
      }
    : {
        service: 'gmail',
        pool:    true,
        maxConnections: 2,
        auth: {
          user: process.env.NODEMAILER_USER,
          pass: process.env.NODEMAILER_PASS,
        },
      }
)

module.exports = transporter
