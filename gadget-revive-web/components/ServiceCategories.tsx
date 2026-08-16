'use client';

import Link from 'next/link';
import {
  WrenchScrewdriverIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  CpuChipIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const serviceCategories = [
  {
    id: 'mobile-repair',
    name: 'Mobile Device Repair',
    description: 'Professional smartphone and tablet repair services',
    icon: DevicePhoneMobileIcon,
    href: '/services/mobile-repair',
    price: 'From $49',
    duration: '30-60 min',
    color: 'bg-blue-500',
    bgGradient: 'from-blue-500 to-indigo-600',
    services: ['Screen Replacement', 'Battery Service', 'Water Damage', 'Camera Repair'],
    popular: true
  },
  {
    id: 'data-recovery',
    name: 'Data Recovery',
    description: 'Recover lost data from damaged or corrupted devices',
    icon: ComputerDesktopIcon,
    href: '/data-recovery',
    price: 'From $199',
    duration: '2-48 hours',
    color: 'bg-red-500',
    bgGradient: 'from-ink to-ink',
    services: ['Hard Drive Recovery', 'SSD Recovery', 'Mobile Data Recovery', 'Emergency Service'],
    urgent: true
  },
  {
    id: 'laptop-repair',
    name: 'Laptop Repair',
    description: 'Complete laptop and computer repair solutions',
    icon: ComputerDesktopIcon,
    href: '/services/laptop-repair',
    price: 'From $89',
    duration: '1-3 hours',
    color: 'bg-green-500',
    bgGradient: 'from-green-500 to-emerald-600',
    services: ['Screen Replacement', 'Keyboard Repair', 'Hardware Upgrade', 'Software Issues']
  },
  {
    id: 'diagnostic',
    name: 'Free Diagnostics',
    description: 'Comprehensive device analysis and issue identification',
    icon: DocumentTextIcon,
    href: '/services/diagnostic',
    price: 'Free',
    duration: '15-30 min',
    color: 'bg-purple-500',
    bgGradient: 'from-purple-500 to-violet-600',
    services: ['Hardware Testing', 'Software Analysis', 'Performance Check', 'Issue Report'],
    free: true
  },
  {
    id: 'chip-repair',
    name: 'Motherboard Repair',
    description: 'Advanced motherboard and chip-level repairs',
    icon: CpuChipIcon,
    href: '/services/chip-repair',
    price: 'From $299',
    duration: '4-24 hours',
    color: 'bg-ink',
    bgGradient: 'from-ink to-ink',
    services: ['Microsoldering', 'IC Replacement', 'Circuit Repair', 'Board Recovery'],
    advanced: true
  },
  {
    id: 'warranty',
    name: 'Warranty Service',
    description: 'Extended warranty and protection plans',
    icon: ShieldCheckIcon,
    href: '/services/warranty',
    price: 'From $29',
    duration: 'Ongoing',
    color: 'bg-teal-500',
    bgGradient: 'from-teal-500 to-cyan-600',
    services: ['90-Day Warranty', 'Extended Coverage', 'Priority Support', 'Free Checkups']
  }
];

export default function ServiceCategories() {
  return (
    <section className="py-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-xl mb-4">
            Our Services
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Professional repair services with expert technicians and guaranteed quality
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {serviceCategories.map((service) => (
            <Link
              key={service.id}
              href={service.href}
              className="group relative overflow-hidden rounded-xl bg-white shadow-lg hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2"
            >
              {/* Badge */}
              {service.popular && (
                <div className="absolute top-4 right-4 z-20">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    Most Popular
                  </span>
                </div>
              )}
              {service.urgent && (
                <div className="absolute top-4 right-4 z-20">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    Emergency
                  </span>
                </div>
              )}
              {service.free && (
                <div className="absolute top-4 right-4 z-20">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    Free Service
                  </span>
                </div>
              )}
              {service.advanced && (
                <div className="absolute top-4 right-4 z-20">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                    Advanced
                  </span>
                </div>
              )}

              {/* Background Gradient */}
              <div className={`absolute top-0 left-0 w-full h-40 bg-gradient-to-r ${service.bgGradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
              
              {/* Decorative Pattern */}
              <div className="absolute top-0 left-0 w-full h-40 opacity-10">
                <div className="absolute top-4 left-4 w-16 h-16 rounded-full border-2 border-white"></div>
                <div className="absolute top-8 right-8 w-8 h-8 rounded-full border border-white"></div>
                <div className="absolute bottom-4 left-8 w-12 h-12 rounded-full border border-white"></div>
              </div>
              
              {/* Content */}
              <div className="relative p-6">
                {/* Icon */}
                <div className="relative z-10 mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                    <service.icon className="w-8 h-8 text-gray-800" />
                  </div>
                </div>

                {/* Service Info */}
                <div className="relative z-10 mb-6">
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-white transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-white/90 text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>

                {/* Pricing & Duration */}
                <div className="relative z-10 mb-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-white/20 text-white">
                      {service.price}
                    </span>
                    <div className="flex items-center text-white/80 text-sm">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {service.duration}
                    </div>
                  </div>
                </div>

                {/* Services List */}
                <div className="mt-5 pt-6 border-t border-white/20">
                  <div className="grid grid-cols-2 gap-2">
                    {service.services.slice(0, 4).map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center text-white/90 text-sm"
                      >
                        <CheckCircleIcon className="w-4 h-4 mr-2 text-white" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6">
                  <div className="inline-flex items-center text-white font-medium text-sm group-hover:text-white transition-colors">
                    Learn More
                    <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">Need Help Choosing?</h3>
            <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
              Our expert technicians are here to help you find the right solution for your device
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 bg-white text-indigo-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Get Free Consultation
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-6 py-3 border-2 border-white text-white font-medium rounded-xl hover:bg-white hover:text-indigo-600 transition-colors"
              >
                View All Services
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}