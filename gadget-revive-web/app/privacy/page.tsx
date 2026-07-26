'use client';

import Link from 'next/link';
import {
  ShieldCheckIcon,
  EyeIcon,
  LockClosedIcon,
  DocumentTextIcon,
  UserIcon,
  ServerIcon,
  TrashIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

const sections = [
  {
    id: 'collection',
    icon: UserIcon,
    title: 'Information We Collect',
    content: [
      {
        subtitle: 'Personal Information',
        text: 'When you use our services, we may collect your name, email address, phone number, and shipping address to process orders and provide support.',
      },
      {
        subtitle: 'Device Information',
        text: 'For repair and data recovery services, we collect device details such as make, model, serial number, and issue descriptions to diagnose and service your equipment.',
      },
      {
        subtitle: 'Payment Information',
        text: 'Payment details are processed securely through trusted third-party payment processors. We do not store your full credit card information on our servers.',
      },
    ],
  },
  {
    id: 'usage',
    icon: EyeIcon,
    title: 'How We Use Your Information',
    content: [
      {
        subtitle: 'Service Delivery',
        text: 'To process repairs, data recovery requests, and product orders. To communicate with you about service status and updates.',
      },
      {
        subtitle: 'Customer Support',
        text: 'To respond to inquiries, provide technical assistance, and resolve any issues with our products or services.',
      },
      {
        subtitle: 'Improvements',
        text: 'To analyze usage patterns and improve our services, website functionality, and customer experience.',
      },
    ],
  },
  {
    id: 'protection',
    icon: LockClosedIcon,
    title: 'Data Protection',
    content: [
      {
        subtitle: 'Security Measures',
        text: 'We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal information.',
      },
      {
        subtitle: 'Data Recovery Confidentiality',
        text: 'All recovered data is handled with strict confidentiality. Our technicians are bound by non-disclosure agreements and professional ethics.',
      },
      {
        subtitle: 'Secure Disposal',
        text: 'Once data recovery is complete and data is returned to you, we securely wipe all copies from our systems unless you request extended backup.',
      },
    ],
  },
  {
    id: 'sharing',
    icon: ServerIcon,
    title: 'Information Sharing',
    content: [
      {
        subtitle: 'Third-Party Services',
        text: 'We may share information with trusted partners for payment processing, shipping, and service delivery. These partners are contractually bound to protect your data.',
      },
      {
        subtitle: 'Legal Requirements',
        text: 'We may disclose information when required by law, court order, or government request, or to protect our rights and safety.',
      },
      {
        subtitle: 'No Selling of Data',
        text: 'We do not sell, rent, or trade your personal information to third parties for marketing purposes.',
      },
    ],
  },
  {
    id: 'rights',
    icon: DocumentTextIcon,
    title: 'Your Rights',
    content: [
      {
        subtitle: 'Access & Correction',
        text: 'You have the right to access, update, or correct your personal information at any time through your account or by contacting us.',
      },
      {
        subtitle: 'Deletion',
        text: 'You may request deletion of your personal data, subject to legal retention requirements and ongoing service obligations.',
      },
      {
        subtitle: 'Opt-Out',
        text: 'You can opt out of marketing communications at any time by clicking the unsubscribe link or contacting our support team.',
      },
    ],
  },
  {
    id: 'cookies',
    icon: ServerIcon,
    title: 'Cookies & Tracking',
    content: [
      {
        subtitle: 'Essential Cookies',
        text: 'We use essential cookies to enable basic website functionality, such as maintaining your session and shopping cart.',
      },
      {
        subtitle: 'Analytics',
        text: 'We may use analytics tools to understand how visitors interact with our website, helping us improve user experience.',
      },
      {
        subtitle: 'Your Choice',
        text: 'You can manage cookie preferences through your browser settings. Disabling cookies may affect some website features.',
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-ink py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-xl mb-6">
            <ShieldCheckIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Your privacy matters to us. This policy explains how Gadget Revive collects, 
            uses, and protects your personal information.
          </p>
          <p className="text-sm text-gray-500 mt-4">Last updated: February 2026</p>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap gap-3 justify-center">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-ink hover:text-white transition-colors"
              >
                <section.icon className="h-4 w-4 mr-2" />
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {sections.map((section, index) => (
              <div key={section.id} id={section.id} className="scroll-mt-24">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 bg-ink rounded-xl flex items-center justify-center">
                    <section.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Section {index + 1}</span>
                    <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                  </div>
                </div>
                <div className="ml-16 space-y-6">
                  {section.content.map((item, itemIndex) => (
                    <div key={itemIndex} className="border-l-2 border-gray-200 pl-6">
                      <h3 className="font-semibold text-gray-900 mb-2">{item.subtitle}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Retention Notice */}
      <section className="bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <TrashIcon className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Data Retention</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  We retain your personal information only for as long as necessary to fulfill the 
                  purposes outlined in this policy, unless a longer retention period is required by law. 
                  Service records may be kept for warranty and support purposes.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  For data recovery services, all recovered data is securely deleted from our systems 
                  within 30 days of delivery, unless you request extended storage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-ink rounded-xl p-8 text-center">
            <EnvelopeIcon className="h-10 w-10 text-white mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Questions About Your Privacy?</h3>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              If you have any questions about this Privacy Policy or how we handle your data, 
              please don't hesitate to contact us.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Contact Us
              </Link>
              <a
                href="mailto:privacy@gadgetrevive.com"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
              >
                privacy@gadgetrevive.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">
            This Privacy Policy may be updated from time to time. We will notify you of any 
            significant changes by posting a notice on our website or sending you an email.
          </p>
          <div className="mt-4 flex justify-center space-x-6">
            <Link href="/terms" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              Terms of Service
            </Link>
            <Link href="/about" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              About Us
            </Link>
            <Link href="/contact" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
