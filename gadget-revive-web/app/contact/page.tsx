'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  ClockIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { branchLocationService, BranchLocation } from '@/lib/api/branchLocation';
import { contactService, ContactSettings } from '@/lib/api/contact';

const BranchMap = dynamic(() => import('@/components/BranchMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
});

const DEFAULT_SUBJECTS = [
  'General Inquiry',
  'Mobile Repair',
  'Data Recovery',
  'Product Purchase',
  'Warranty Claim',
  'Technical Support',
  'Business Partnership',
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [mainBranch, setMainBranch] = useState<BranchLocation | null>(null);
  const [settings, setSettings] = useState<ContactSettings>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    branchLocationService.getAll().then((locs) => {
      setBranches(locs);
      const featured = locs.find((l) => l.is_featured) ?? locs[0] ?? null;
      setMainBranch(featured);
    }).catch(() => {});

    contactService.getSettings()
      .then(setSettings)
      .catch(() => { /* fall back to DEFAULT_SUBJECTS and defaults below */ })
      .finally(() => setSettingsLoaded(true));
  }, []);

  // Only apply hardcoded English defaults once the settings endpoint has
  // resolved, otherwise the hero/subjects would flash demo copy that's been
  // overwritten in the admin CMS.
  const heroTitle = settingsLoaded ? (settings.contact_hero_title || 'Get In Touch') : '';
  const heroSubtitle = settingsLoaded
    ? (settings.contact_hero_subtitle || 'Have a question or need help? Our team is here to assist you 24/7.')
    : '';
  const supportEmail = settingsLoaded ? (settings.contact_support_email || 'support@gadgetrevive.com') : '';
  const subjects = settingsLoaded
    ? (settings.contact_subjects?.length ? settings.contact_subjects : DEFAULT_SUBJECTS)
    : [];

  const contactMethods = [
    {
      icon: PhoneIcon,
      title: 'Call Us',
      description: 'Mon-Sat 9AM-8PM',
      link: mainBranch ? `tel:${mainBranch.phone.replace(/[\s\-()]/g, '')}` : 'tel:',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: EnvelopeIcon,
      title: 'Email Us',
      description: 'We reply within 24 hours',
      link: `mailto:${supportEmail}`,
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: MapPinIcon,
      title: 'Visit Us',
      description: branches.length > 0 ? `${branches.length} location${branches.length !== 1 ? 's' : ''} in Dhaka` : 'Find Nearest Store',
      link: '/locations',
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await contactService.submit({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message,
      });
      setSubmitted(true);
    } catch {
      setSubmitError('Failed to send your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSubmitError(null);
    setFormData({ firstName: '', lastName: '', email: '', phone: '', subject: subjects[0] || 'General Inquiry', message: '' });
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative bg-ink overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        <div className="relative max-w-[1800px] mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center">
          {settingsLoaded ? (
            <>
              <h1 className="text-2xl lg:text-2xl font-bold text-white mb-2">
                {heroTitle}
              </h1>
              <p className="text-base text-gray-300 max-w-xl mx-auto">
                {heroSubtitle}
              </p>
            </>
          ) : (
            <>
              <div className="h-8 lg:h-9 w-56 bg-white/10 rounded animate-pulse mx-auto mb-3" />
              <div className="h-5 w-4/5 max-w-xl bg-white/10 rounded animate-pulse mx-auto" />
            </>
          )}
        </div>
      </div>

      {/* Quick Contact Methods */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          {contactMethods.map((method) => (
            <a
              key={method.title}
              href={method.link}
              className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all text-center"
            >
              <div className={`w-10 h-10 rounded-lg ${method.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform mx-auto`}>
                <method.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{method.title}</h3>
              <p className="text-xs text-gray-500">{method.description}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Contact Form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center">
                  <EnvelopeIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Send us a Message</h2>
                  <p className="text-xs text-gray-500">We&apos;ll get back to you within 24 hours</p>
                </div>
              </div>

              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Message Sent!</h3>
                  <p className="text-gray-600 text-sm mb-4">Thank you for contacting us. We&apos;ll respond shortly.</p>
                  <button
                    onClick={handleReset}
                    className="text-gray-900 text-sm font-semibold hover:text-gray-600"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="firstName" className="block text-xs font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        id="firstName"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-xs font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        id="lastName"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent transition-all"
                        placeholder="+880 1XXX-XXXXXX"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-xs font-medium text-gray-700 mb-1">
                      Subject
                    </label>
                    <select
                      name="subject"
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent transition-all bg-white"
                    >
                      {subjects.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-xs font-medium text-gray-700 mb-1">
                      Message
                    </label>
                    <textarea
                      name="message"
                      id="message"
                      rows={3}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent transition-all resize-none"
                      placeholder="Please describe your inquiry..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-ink text-white rounded-lg font-semibold text-sm hover:bg-ink/90 focus:ring-2 focus:ring-offset-2 focus:ring-ink transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <ArrowRightIcon className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            {/* Emergency Service */}
            <div className="bg-ink rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <PhoneIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">24/7 Emergency</h3>
                  <p className="text-xs text-gray-300">For urgent repairs</p>
                </div>
              </div>
              {mainBranch ? (
                <a
                  href={`tel:${mainBranch.phone.replace(/[\s\-()]/g, '')}`}
                  className="flex items-center justify-center gap-2 w-full bg-white text-gray-900 py-2 px-3 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-all"
                >
                  <PhoneIcon className="h-4 w-4" />
                  {mainBranch.phone}
                </a>
              ) : (
                <div className="h-9 bg-white/10 rounded-lg animate-pulse" />
              )}
            </div>

            {/* Working Hours */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                  <ClockIcon className="h-4 w-4 text-gray-700" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Working Hours</h3>
              </div>
              {mainBranch?.hours ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{mainBranch.name}</span>
                    <span className="font-medium text-gray-900">{mainBranch.hours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emergency</span>
                    <span className="font-medium text-green-600">24/7</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sat - Thu</span>
                    <span className="font-medium text-gray-900">10AM - 8PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Friday</span>
                    <span className="font-medium text-gray-900">2PM - 8PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emergency</span>
                    <span className="font-medium text-green-600">24/7</span>
                  </div>
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Follow Us</h3>
              <div className="flex gap-2">
                <a href={settings.contact_social_facebook || '#'} className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href={settings.contact_social_instagram || '#'} className="w-9 h-9 rounded-lg bg-pink-600 flex items-center justify-center text-white hover:bg-pink-700 transition-colors">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href={settings.contact_social_whatsapp || '#'} className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center text-white hover:bg-green-700 transition-colors">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                <a href={settings.contact_social_youtube || '#'} className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-colors">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Locations */}
      <div className="bg-gray-50 py-6">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Our Service Centers</h2>
            <p className="text-gray-600 text-sm">Visit any of our branches across Dhaka</p>
          </div>
          {branches.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {branches.map((branch) => (
                <div key={branch.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{branch.name}</h3>
                    {branch.is_featured && (
                      <span className="ml-auto text-xs text-amber-600 font-medium flex-shrink-0">Main</span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-600">{branch.address}</p>
                    <p className="text-gray-900 font-medium">{branch.phone}</p>
                    {branch.hours && <p className="text-gray-500">{branch.hours}</p>}
                    {branch.map_url && (
                      <a
                        href={branch.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 mt-1"
                      >
                        <MapPinIcon className="h-3 w-3" />
                        Get directions
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-center mt-6">
            <Link
              href="/locations"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              View all locations
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
          <div className="bg-ink px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <GlobeAltIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Find Us on Map</h3>
                <p className="text-xs text-gray-400">All our service centers in Dhaka</p>
              </div>
            </div>
            {mainBranch?.map_url ? (
              <a
                href={mainBranch.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <MapPinIcon className="h-4 w-4" />
                Get Directions
              </a>
            ) : (
              <a
                href="https://www.openstreetmap.org/search?query=gadget+repair+dhaka"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <MapPinIcon className="h-4 w-4" />
                Get Directions
              </a>
            )}
          </div>
          <div className="h-72 bg-gray-100 relative">
            <BranchMap branches={branches} mainBranch={mainBranch} />
          </div>
        </div>
      </div>
    </div>
  );
}
