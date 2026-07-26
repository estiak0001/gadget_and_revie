'use client';

import Link from 'next/link';
import {
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const returnTimelines = [
  {
    type: 'Unopened Products',
    days: '7 Days',
    description: 'Full refund for products in original sealed packaging',
    icon: CheckCircleIcon,
  },
  {
    type: 'Defective Products',
    days: '15 Days',
    description: 'Exchange or refund for manufacturing defects',
    icon: ArrowPathIcon,
  },
  {
    type: 'Wrong Item Delivered',
    days: '3 Days',
    description: 'Free replacement with correct item',
    icon: TruckIcon,
  },
  {
    type: 'Warranty Claims',
    days: '90 Days',
    description: 'Repair or replacement under warranty terms',
    icon: ClockIcon,
  },
];

const eligibleItems = [
  'Computer parts in original packaging (unopened)',
  'Accessories with intact seals and tags',
  'Defective products with proof of defect',
  'Wrong items delivered (must match order details)',
  'Products damaged during shipping',
  'Items not matching product description',
];

const nonEligibleItems = [
  'Opened software, licenses, or digital products',
  'Customized or special-order items',
  'Products with removed serial numbers or labels',
  'Items damaged by customer misuse',
  'Products returned after the return window',
  'Consumable items (thermal paste, cleaning supplies)',
  'Data recovery service fees (after service completion)',
];

const refundMethods = [
  {
    method: 'Original Payment Method',
    timeline: '5-7 business days',
    description: 'Refund to credit/debit card or mobile banking account',
  },
  {
    method: 'Store Credit',
    timeline: '24-48 hours',
    description: 'Instant credit for future purchases (10% bonus value)',
  },
  {
    method: 'Bank Transfer',
    timeline: '3-5 business days',
    description: 'Direct transfer to your bank account',
  },
  {
    method: 'bKash / Nagad',
    timeline: '1-2 business days',
    description: 'Refund to your mobile wallet',
  },
];

const returnSteps = [
  {
    step: 1,
    title: 'Initiate Return Request',
    description: 'Log into your account or contact our support team with your order number and reason for return.',
  },
  {
    step: 2,
    title: 'Receive Approval',
    description: 'Our team will review your request within 24 hours and provide return authorization if eligible.',
  },
  {
    step: 3,
    title: 'Pack the Item',
    description: 'Pack the product securely in original packaging with all accessories, manuals, and invoice.',
  },
  {
    step: 4,
    title: 'Ship or Drop Off',
    description: 'Use our pickup service (free for defective items) or drop off at our Dhanmondi service center.',
  },
  {
    step: 5,
    title: 'Inspection & Refund',
    description: 'Once received, we inspect the item within 48 hours and process your refund immediately.',
  },
];

export default function ReturnsPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-ink py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-xl mb-6">
            <ArrowPathIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Return & Refund Policy</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            We want you to be completely satisfied with your purchase. If something isn't right, 
            we're here to help with hassle-free returns and refunds.
          </p>
          <p className="text-sm text-gray-500 mt-4">Effective: February 2026 | Bangladesh Standard</p>
        </div>
      </section>

      {/* Return Timeline Cards */}
      <section className="relative -mt-4 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-md p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {returnTimelines.map((item) => (
              <div key={item.type} className="text-center p-4 border border-gray-100 rounded-xl">
                <item.icon className="h-8 w-8 text-gray-800 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{item.days}</p>
                <p className="font-medium text-gray-900 text-sm">{item.type}</p>
                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Return Process Steps */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">How to Return</h2>
            <p className="text-gray-600">Simple 5-step return process</p>
          </div>
          <div className="space-y-4">
            {returnSteps.map((step, index) => (
              <div 
                key={step.step} 
                className="flex items-start space-x-4 p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-ink rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">{step.step}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Eligible vs Non-Eligible */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">What Can Be Returned?</h2>
            <p className="text-gray-600">Check if your item qualifies for return</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {/* Eligible */}
            <div className="bg-white rounded-xl p-8 border-2 border-ink">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-ink rounded-lg flex items-center justify-center">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Eligible for Return</h3>
              </div>
              <ul className="space-y-3">
                {eligibleItems.map((item, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <CheckCircleIcon className="h-5 w-5 text-gray-700 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Non-Eligible */}
            <div className="bg-white rounded-xl p-8 border border-gray-200">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <XCircleIcon className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Not Eligible</h3>
              </div>
              <ul className="space-y-3">
                {nonEligibleItems.map((item, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <XCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Refund Methods */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Refund Options</h2>
            <p className="text-gray-600">Choose how you'd like to receive your refund</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {refundMethods.map((refund) => (
              <div 
                key={refund.method} 
                className="p-6 border border-gray-200 rounded-xl hover:border-ink transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{refund.method}</h3>
                  <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                    {refund.timeline}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{refund.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Returns Notice */}
      <section className="py-6 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-ink rounded-xl flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Important: Service Return Policy</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    <strong>Data Recovery Services:</strong> Service fees are non-refundable once data recovery 
                    is attempted. If recovery is unsuccessful, you will not be charged. Diagnostic fees are 
                    non-refundable.
                  </p>
                  <p>
                    <strong>PC Repair Services:</strong> If you're unsatisfied with a repair, contact us within 
                    7 days. We'll redo the work at no extra cost under our service warranty. Labor fees are 
                    non-refundable once work is completed.
                  </p>
                  <p>
                    <strong>Replacement Parts Used in Repairs:</strong> Parts replaced during service are covered 
                    under the 90-day service warranty. Original defective parts can be returned upon request.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shipping Costs */}
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-100 rounded-xl p-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <TruckIcon className="h-6 w-6 text-gray-800" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Return Shipping</h3>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 mb-1">Free Return Shipping</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Defective or damaged products</li>
                      <li>• Wrong items delivered</li>
                      <li>• Items not matching description</li>
                    </ul>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 mb-1">Customer Pays Shipping</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Change of mind returns</li>
                      <li>• Unwanted gifts</li>
                      <li>• Incorrect size/model ordered</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  * For Dhaka city, use our free pickup service for eligible returns. Outside Dhaka, use 
                  Sundarban Courier or SA Paribahan (we'll reimburse shipping for eligible items).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact for Returns */}
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-ink rounded-xl p-8 text-center">
            <PhoneIcon className="h-10 w-10 text-white mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Need Help with a Return?</h3>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Our support team is available Saturday-Thursday, 10 AM - 8 PM. We'll guide you 
              through the return process and answer any questions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/support/new"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Submit Return Request
              </Link>
              <a
                href="tel:+8801711123456"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
              >
                <PhoneIcon className="h-5 w-5 mr-2" />
                Call: 01711-123456
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">
            This return policy is in accordance with Bangladesh Consumer Rights Protection Act, 2009 
            and e-commerce guidelines. Gadget Revive reserves the right to modify this policy at any time.
          </p>
          <div className="mt-4 flex justify-center space-x-6">
            <Link href="/terms" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              Privacy Policy
            </Link>
            <Link href="/warranty" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              Warranty Info
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
