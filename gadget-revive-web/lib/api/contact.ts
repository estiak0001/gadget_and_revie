import apiClient from './config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactSettings {
  contact_hero_title?: string;
  contact_hero_subtitle?: string;
  contact_support_email?: string;
  contact_subjects?: string[];
  contact_social_facebook?: string;
  contact_social_instagram?: string;
  contact_social_whatsapp?: string;
  contact_social_youtube?: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const contactService = {
  /**
   * Submit a contact inquiry (public).
   */
  submit: async (data: ContactFormData): Promise<void> => {
    await apiClient.post('/contact', data);
  },

  /**
   * Fetch contact page CMS settings.
   */
  getSettings: async (): Promise<ContactSettings> => {
    try {
      const res = await apiClient.get('/public/contact');
      return res.data?.data || {};
    } catch {
      return {};
    }
  },
};
