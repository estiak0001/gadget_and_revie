'use client';

import Link from 'next/link';
import {
  DocumentTextIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const sections = [
  {
    id: 'acceptance',
    icon: DocumentTextIcon,
    title: 'Acceptance of Terms',
    content: [
      {
        subtitle: 'Agreement',
        text: 'By accessing or using Gadget Revive\'s website, services, or purchasing our products, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.',
      },
      {
        subtitle: 'Eligibility',
        text: 'You must be at least 18 years old or have parental consent to use our services. By using our services, you represent that you meet these requirements.',
      },
      {
        subtitle: 'Modifications',
        text: 'We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.',
      },
    ],
  },
  {
    id: 'services',
    icon: WrenchScrewdriverIcon,
    title: 'Repair & Data Recovery Services',
    content: [
      {
        subtitle: 'Service Agreement',
        text: 'When you submit a device for repair or data recovery, you authorize us to perform diagnostic tests and necessary repairs. We will provide a quote before proceeding with any paid work.',
      },
      {
        subtitle: 'Data Recovery Disclaimer',
        text: 'While we maintain a high success rate, data recovery cannot be guaranteed in all cases. Severely damaged storage media may not yield recoverable data. No charge is applied if data recovery is unsuccessful.',
      },
      {
        subtitle: 'Device Ownership',
        text: 'You confirm that you are the lawful owner of any device submitted for service or have authorization from the owner to request repairs.',
      },
      {
        subtitle: 'Backup Responsibility',
        text: 'We recommend backing up your data before submitting devices for any service. Gadget Revive is not responsible for data loss during repair procedures unless caused by our negligence.',
      },
    ],
  },
  {
    id: 'products',
    icon: CubeIcon,
    title: 'Products & Parts',
    content: [
      {
        subtitle: 'Product Descriptions',
        text: 'We strive to provide accurate product descriptions and images. However, actual products may vary slightly. All specifications are subject to change without notice.',
      },
      {
        subtitle: 'Availability',
        text: 'Product availability is subject to change. We reserve the right to limit quantities and discontinue products at any time.',
      },
      {
        subtitle: 'Compatibility',
        text: 'It is your responsibility to verify product compatibility with your devices before purchase. Our team is available to assist with compatibility questions.',
      },
    ],
  },
  {
    id: 'pricing',
    icon: CreditCardIcon,
    title: 'Pricing & Payment',
    content: [
      {
        subtitle: 'Pricing',
        text: 'All prices are listed in BDT (Bangladeshi Taka) and are subject to change. Quoted prices for services are valid for 7 days from the date of quotation.',
      },
      {
        subtitle: 'Payment Methods',
        text: 'We accept major credit cards, debit cards, mobile banking (bKash, Nagad), and bank transfers. Payment is required before device pickup for repair services.',
      },
      {
        subtitle: 'Diagnostic Fees',
        text: 'A diagnostic fee may apply for device assessment. This fee is waived if you proceed with the repair. Diagnostic fees are non-refundable.',
      },
    ],
  },
  {
    id: 'warranty',
    icon: ShieldCheckIcon,
    title: 'Warranty & Guarantees',
    content: [
      {
        subtitle: 'Service Warranty',
        text: 'Repair services are covered by a 90-day warranty against defects in workmanship. This warranty does not cover physical damage, water damage, or issues unrelated to the original repair.',
      },
      {
        subtitle: 'Parts Warranty',
        text: 'Replacement parts come with manufacturer warranty periods varying by product. Warranty claims must be submitted with proof of purchase.',
      },
      {
        subtitle: 'Warranty Exclusions',
        text: 'Warranty is void if the device has been tampered with by unauthorized parties, subjected to misuse, or if damage is caused by external factors.',
      },
    ],
  },
  {
    id: 'returns',
    icon: ClockIcon,
    title: 'Returns & Refunds',
    content: [
      {
        subtitle: 'Product Returns',
        text: 'Unopened products may be returned within 7 days of purchase for a full refund. Products must be in original packaging and condition.',
      },
      {
        subtitle: 'Defective Products',
        text: 'Defective products may be exchanged or refunded within 30 days. Proof of purchase and evidence of defect are required.',
      },
      {
        subtitle: 'Service Refunds',
        text: 'Service fees are non-refundable once work has been completed. If you are unsatisfied with a repair, we will attempt to resolve the issue under warranty.',
      },
    ],
  },
  {
    id: 'liability',
    icon: ExclamationTriangleIcon,
    title: 'Limitation of Liability',
    content: [
      {
        subtitle: 'Service Limitations',
        text: 'Gadget Revive\'s liability is limited to the value of services rendered or products purchased. We are not liable for indirect, incidental, or consequential damages.',
      },
      {
        subtitle: 'Data Loss',
        text: 'While we take precautions, we are not liable for data loss except in cases of proven negligence. Maximum liability for data recovery services is limited to the service fee paid.',
      },
      {
        subtitle: 'Third-Party Services',
        text: 'We are not responsible for any third-party services, products, or websites linked from our platform.',
      },
    ],
  },
  {
    id: 'conduct',
    icon: ScaleIcon,
    title: 'User Conduct',
    content: [
      {
        subtitle: 'Prohibited Activities',
        text: 'You agree not to use our services for any illegal purpose, submit stolen devices, or provide false information. Violation may result in service termination and legal action.',
      },
      {
        subtitle: 'Respectful Interaction',
        text: 'We expect respectful communication with our staff. Abusive or threatening behavior will not be tolerated and may result in refusal of service.',
      },
    ],
  },
  {
    id: 'termination',
    icon: XCircleIcon,
    title: 'Termination',
    content: [
      {
        subtitle: 'Right to Refuse',
        text: 'We reserve the right to refuse service to anyone for any reason, including violation of these terms or suspected fraudulent activity.',
      },
      {
        subtitle: 'Account Termination',
        text: 'We may terminate or suspend your account without prior notice for violations of these terms. Outstanding obligations remain payable.',
      },
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-ink py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-xl mb-6">
            <DocumentTextIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Please read these terms carefully before using Gadget Revive's services. 
            These terms govern your use of our website, services, and products.
          </p>
          <p className="text-sm text-gray-500 mt-4">Last updated: February 2026</p>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-ink hover:text-white transition-colors"
              >
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
              <div key={section.id} id={section.id} className="scroll-mt-32">
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

      {/* Governing Law */}
      <section className="bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <ScaleIcon className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Governing Law</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  These Terms of Service are governed by and construed in accordance with the laws of 
                  Bangladesh. Any disputes arising from these terms shall be subject to the exclusive 
                  jurisdiction of the courts in Dhaka, Bangladesh.
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  If any provision of these terms is found to be invalid or unenforceable, the remaining 
                  provisions shall continue in full force and effect.
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
            <DocumentTextIcon className="h-10 w-10 text-white mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Questions About These Terms?</h3>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              If you have any questions about these Terms of Service, please contact us. 
              We're here to help clarify any concerns.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Contact Us
              </Link>
              <a
                href="mailto:legal@gadgetrevive.com"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
              >
                legal@gadgetrevive.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">
            By using our services, you acknowledge that you have read, understood, and agree 
            to be bound by these Terms of Service.
          </p>
          <div className="mt-4 flex justify-center space-x-6">
            <Link href="/privacy" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              Privacy Policy
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
