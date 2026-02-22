import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

// Only create transporter if SMTP is configured
let transporter: nodemailer.Transporter | null = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.warn('⚠️  SMTP not configured - email sending disabled');
}

export const sendVerificationEmail = async (email: string, token: string) => {
  if (!transporter) {
    console.warn('Email service not configured - skipping verification email');
    return;
  }

  const verificationUrl = `${process.env.APP_URL || 'http://localhost:3001'}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@guardianconnect.com',
    to: email,
    subject: 'Verify your Guardian Connect account',
    html: `
      <h2>Welcome to Guardian Connect</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>Or copy this link: ${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  if (!transporter) {
    console.warn('Email service not configured - skipping password reset email');
    return;
  }

  const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@guardianconnect.com',
    to: email,
    subject: 'Reset your Guardian Connect password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

export const sendContactInvitation = async (
  email: string,
  inviterName: string,
  downloadLink: string
) => {
  if (!transporter) {
    console.warn('Email service not configured - skipping contact invitation email');
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@guardianconnect.com',
    to: email,
    subject: `${inviterName} wants to add you as an emergency contact`,
    html: `
      <h2>You've been invited to Guardian Connect</h2>
      <p>${inviterName} wants to add you as an emergency contact.</p>
      <p>Download the app to accept:</p>
      <a href="${downloadLink}">Download Guardian Connect</a>
      <p>Or copy this link: ${downloadLink}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Contact invitation sent to ${email}`);
  } catch (error) {
    console.error('Error sending contact invitation:', error);
    throw error;
  }
};

