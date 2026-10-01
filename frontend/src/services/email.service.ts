import axios from "axios";

const API_URL = "http://localhost:5000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("reachinbox_token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

export interface ScheduledEmail {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
}

export interface SentEmail {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  sentAt: string | null;
  status: string;
  failureReason: string | null;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  campaigns: number;
}

export const getEmailStats = async (): Promise<EmailStats> => {
  const response = await axios.get(`${API_URL}/emails/stats`, {
    headers: getAuthHeaders(),
  });

  return response.data.data;
};

export const getScheduledEmails = async (): Promise<ScheduledEmail[]> => {
  const response = await axios.get(`${API_URL}/emails/scheduled`, {
    headers: getAuthHeaders(),
  });

  return response.data.data;
};

export const getSentEmails = async (): Promise<SentEmail[]> => {
  const response = await axios.get(`${API_URL}/emails/sent`, {
    headers: getAuthHeaders(),
  });

  return response.data.data;
};