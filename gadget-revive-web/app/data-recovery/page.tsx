'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { serviceService } from '@/lib/api';
import { apiClient, getStorageUrl } from '@/lib/api/config';
import { Service, Faq } from '@/lib/types';
import {
  ComputerDesktopIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ServerIcon,
  DevicePhoneMobileIcon,
  CircleStackIcon,
  CpuChipIcon,
  PhoneIcon,
  ArrowRightIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

// ── Icon map: string name → Heroicon component ────────────────────────────────

type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

const ICON_MAP: Record<string, HeroIconComponent> = {
  ServerIcon,
  CircleStackIcon,
  DevicePhoneMobileIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  LockClosedIcon,
  WrenchScrewdriverIcon,
  PhoneIcon,
  ChartBarIcon,
  ClockIcon,
};

function resolveIcon(name: string): HeroIconComponent {
  return ICON_MAP[name] ?? ServerIcon;
}

// ── CMS data types (mirror the seeder structure) ──────────────────────────────

interface Stat     { value: string; label: string }
interface Scenario { scenario: string; icon: string; recoverable: boolean }
interface Feature  { name: string; icon: string; description: string; successRate: string }
interface Step     { step: string; title: string; description: string; icon: string; color: string; time: string }
interface Guarantee { icon: string; title: string; description: string }
interface Benefit  { emoji: string; title: string; description: string }

interface DrHero {
  badge_text: string; title_line1: string; title_line2: string; description: string;
  stats: Stat[]; cta1_text: string; cta1_link: string; phone_number: string; phone_display: string;
}
interface DrLossScenarios { title: string; description: string; items: Scenario[] }
interface DrFeatures       { label: string; title: string; description: string; items: Feature[] }
interface DrEmergencyAlert { title: string; description: string }
interface DrServicesSection {
  title: string; description: string; guarantee_badge: string; cta_text: string; cta_link: string;
}
interface DrProcess {
  badge_text: string; title: string; description: string; steps: Step[];
  cta_heading: string; cta_description: string; cta_btn_text: string;
  cta_btn_link: string; cta_phone_text: string; cta_phone: string;
}
interface DrGuarantees {
  title: string; description: string; items: Guarantee[];
  why_title: string; why_description: string; benefits: Benefit[];
}
interface DrFaqSection { title: string; description: string }
interface DrCta {
  badge_text: string; title: string; description: string;
  phone: string; phone_display: string; phone_label: string;
  link_text: string; link_href: string; trust_indicators: string[];
}

interface DrCmsSettings {
  dr_hero?:             DrHero;
  dr_loss_scenarios?:   DrLossScenarios;
  dr_features?:         DrFeatures;
  dr_emergency_alert?:  DrEmergencyAlert;
  dr_services_section?: DrServicesSection;
  dr_process?:          DrProcess;
  dr_guarantees?:       DrGuarantees;
  dr_faq_section?:      DrFaqSection;
  dr_cta?:              DrCta;
}

// ── Fallback / default content (identical to original hardcoded data) ─────────

const DEFAULT_HERO: DrHero = {
  badge_text: '98% Success Rate • No Data, No Fee',
  title_line1: 'Lost Your Data?', title_line2: 'We Can Recover It!',
  description: 'Professional data recovery services in Dhaka, Bangladesh. From damaged hard drives to deleted files - we recover what matters most to you.',
  stats: [
    { value: '98%',  label: 'Success Rate' },
    { value: '24h',  label: 'Free Diagnosis' },
    { value: '10K+', label: 'Recovered Devices' },
    { value: '100%', label: 'Confidential' },
  ],
  cta1_text: 'Get Free Diagnosis', cta1_link: '#services',
  phone_number: '+880 1711-123456', phone_display: 'Emergency: +880 1711-123456',
};

const DEFAULT_SCENARIOS: DrLossScenarios = {
  title: '💾 What Data Loss Situations Do We Handle?',
  description: 'No matter how you lost your data, we have the expertise to recover it',
  items: [
    { scenario: 'Accidental Deletion', icon: '🗑️', recoverable: true },
    { scenario: 'Formatted Drive', icon: '💾', recoverable: true },
    { scenario: 'Water Damage', icon: '💧', recoverable: true },
    { scenario: 'Physical Damage', icon: '🔨', recoverable: true },
    { scenario: 'Virus/Malware Attack', icon: '🦠', recoverable: true },
    { scenario: 'Power Failure', icon: '⚡', recoverable: true },
    { scenario: 'Corrupted Files', icon: '📁', recoverable: true },
    { scenario: 'System Crash', icon: '💥', recoverable: true },
    { scenario: 'Overwritten Data', icon: '🔄', recoverable: true },
    { scenario: 'Partition Loss', icon: '💿', recoverable: true },
    { scenario: 'Bad Sectors', icon: '🔴', recoverable: true },
    { scenario: 'Firmware Failure', icon: '⚙️', recoverable: true },
    { scenario: 'Fire Damage', icon: '🔥', recoverable: true },
    { scenario: 'Mechanical Failure', icon: '🔧', recoverable: true },
    { scenario: 'Dropped Device', icon: '📱', recoverable: true },
    { scenario: 'Ransomware Attack', icon: '🔒', recoverable: true },
  ],
};

const DEFAULT_FEATURES: DrFeatures = {
  label: '🔧 Specialized Recovery Services',
  title: 'We Recover Data From All Types of Devices',
  description: 'Advanced tools, expert technicians, and clean room facilities',
  items: [
    { name: 'Hard Drive Recovery',      icon: 'ServerIcon',            description: 'Mechanical & logical failures',   successRate: '95%' },
    { name: 'SSD Data Recovery',        icon: 'CircleStackIcon',       description: 'Solid state drive recovery',      successRate: '92%' },
    { name: 'Mobile Device Recovery',   icon: 'DevicePhoneMobileIcon', description: 'Android & iOS devices',           successRate: '98%' },
    { name: 'Memory Card Recovery',     icon: 'CpuChipIcon',           description: 'SD, microSD, CF cards',           successRate: '96%' },
    { name: 'RAID Array Recovery',      icon: 'ServerIcon',            description: 'Complex RAID systems',            successRate: '90%' },
    { name: 'USB Drive Recovery',       icon: 'CircleStackIcon',       description: 'Flash drives & pen drives',       successRate: '94%' },
    { name: 'Email Recovery',           icon: 'DocumentTextIcon',      description: 'Lost emails & archives',          successRate: '99%' },
    { name: 'Database Recovery',        icon: 'CloudArrowUpIcon',      description: 'SQL, MySQL, Oracle',              successRate: '93%' },
    { name: 'Laptop/Desktop Recovery',  icon: 'ComputerDesktopIcon',   description: 'Complete system recovery',        successRate: '96%' },
    { name: 'External Hard Drive',      icon: 'CircleStackIcon',       description: 'Portable drives recovery',        successRate: '95%' },
    { name: 'NAS Recovery',             icon: 'ServerIcon',            description: 'Network Attached Storage',        successRate: '91%' },
    { name: 'Tablet Recovery',          icon: 'DevicePhoneMobileIcon', description: 'iPad & Android tablets',          successRate: '97%' },
    { name: 'Camera/DSLR Recovery',     icon: 'CpuChipIcon',           description: 'Professional camera data',        successRate: '96%' },
    { name: 'DVR/CCTV Recovery',        icon: 'ServerIcon',            description: 'Security footage recovery',       successRate: '89%' },
    { name: 'Virtual Machine Recovery', icon: 'CloudArrowUpIcon',      description: 'VM data files recovery',          successRate: '94%' },
    { name: 'Server Recovery',          icon: 'ServerIcon',            description: 'Enterprise server data',          successRate: '92%' },
    { name: 'Game Console Recovery',    icon: 'CpuChipIcon',           description: 'PS5, Xbox, Switch data',          successRate: '88%' },
    { name: 'Cloud Data Recovery',      icon: 'CloudArrowUpIcon',      description: 'Deleted cloud files',             successRate: '97%' },
  ],
};

const DEFAULT_EMERGENCY: DrEmergencyAlert = {
  title: '⚠️ CRITICAL: Stop Using Your Device Immediately!',
  description: 'Continued use can permanently damage your data. Power off your device and contact us right away to maximize recovery chances.',
};

const DEFAULT_SERVICES_SECTION: DrServicesSection = {
  title: '💰 Transparent Pricing',
  description: 'No hidden fees. Pay only if we successfully recover your data.',
  guarantee_badge: 'No Data, No Charge Guarantee',
  cta_text: 'Contact us for a personalized quote',
  cta_link: '/contact',
};

const DEFAULT_PROCESS: DrProcess = {
  badge_text: 'Simple 4-Step Process',
  title: 'How We Recover Your Data',
  description: "Clear, transparent process from diagnosis to delivery. You're informed at every step.",
  steps: [
    { step: '1', title: 'Free Diagnosis',          description: 'Bring or ship your device to us. We perform a complete evaluation and provide a detailed report within 24 hours.', icon: 'DocumentTextIcon', color: 'from-blue-500 to-cyan-500',    time: '24 hours' },
    { step: '2', title: 'Quote Approval',          description: 'Review our transparent pricing and recovery success probability. No hidden fees - you decide if you want to proceed.',     icon: 'CheckCircleIcon',  color: 'from-purple-500 to-pink-500',  time: 'Instant'  },
    { step: '3', title: 'Data Recovery',           description: 'Our expert technicians use advanced tools and clean room facilities to safely recover your data.',                            icon: 'CpuChipIcon',      color: 'from-orange-500 to-red-500',   time: '2-5 days' },
    { step: '4', title: 'Verification & Delivery', description: 'We verify all recovered data, provide a detailed report, and securely transfer your files to you.',                          icon: 'ShieldCheckIcon',  color: 'from-green-500 to-emerald-500',time: '1 day'    },
  ],
  cta_heading: 'Ready to Start the Recovery Process?',
  cta_description: 'Bring your device to any of our 5 locations in Dhaka or request a free pickup',
  cta_btn_text: 'View Services & Pricing', cta_btn_link: '#services',
  cta_phone_text: 'Call for Free Consultation', cta_phone: '+880 1711-123456',
};

const DEFAULT_GUARANTEES: DrGuarantees = {
  title: '🛡️ Our Commitment to You',
  description: "Your trust is our priority. Here's what makes us Bangladesh's #1 data recovery service.",
  items: [
    { icon: 'ShieldCheckIcon', title: 'No Data, No Charge',  description: "If we can't recover your data, you pay absolutely nothing. That's our guarantee of confidence in our expertise." },
    { icon: 'LockClosedIcon',  title: '100% Confidential',   description: 'Your data is handled with military-grade security. We sign NDAs and ensure complete privacy for all clients.' },
    { icon: 'CheckCircleIcon', title: 'Free Diagnosis',       description: "Get a detailed evaluation within 24 hours. We'll tell you exactly what can be recovered before you commit." },
  ],
  why_title: 'Why Choose RecuvaPro?',
  why_description: '10+ years of experience serving businesses and individuals across Bangladesh',
  benefits: [
    { emoji: '⚡', title: 'Fast Turnaround', description: 'Most recoveries completed within 2-5 days' },
    { emoji: '🏆', title: 'Expert Team',     description: 'Certified technicians with 10+ years experience' },
    { emoji: '🔬', title: 'Clean Room Lab',  description: 'ISO-certified clean room for physical recovery' },
    { emoji: '🚚', title: 'Free Pickup',     description: 'Complimentary pickup & delivery in Dhaka' },
  ],
};

const DEFAULT_FAQ: DrFaqSection = {
  title: '❓ Frequently Asked Questions',
  description: 'Everything you need to know about our data recovery service',
};

const DEFAULT_CTA: DrCta = {
  badge_text: '24/7 Emergency Service Available',
  title: "🚨 Lost Critical Data?\nWe're Here to Help!",
  description: "Don't panic! Our expert team is ready to recover your important files. Contact us now for immediate assistance and free diagnosis.",
  phone: '+880 1711-123456', phone_display: '+880 1711-123456', phone_label: 'Call Now',
  link_text: 'Visit Our Centers', link_href: '/contact',
  trust_indicators: ['Free Diagnosis', 'No Data, No Fee', 'Same Day Pickup'],
};

// ── Page component ────────────────────────────────────────────────────────────

export default function DataRecoveryPage() {
  const [dataRecoveryServices, setDataRecoveryServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices]           = useState(true);
  const [faqs, setFaqs]                                 = useState<Faq[]>([]);
  const [faqsLoading, setFaqsLoading]                   = useState(true);
  const [cms, setCms]                                   = useState<DrCmsSettings>({});
  const [cmsLoaded, setCmsLoaded]                       = useState(false);

  useEffect(() => {
    // Fetch CMS settings
    const fetchCms = async () => {
      try {
        const response = await apiClient.get('/public/data-recovery');
        const raw = response.data.data || {};
        const parsed: DrCmsSettings = {};
        for (const [key, value] of Object.entries(raw)) {
          try {
            (parsed as Record<string, unknown>)[key] = typeof value === 'string' ? JSON.parse(value) : value;
          } catch {
            // skip malformed field
          }
        }
        setCms(parsed);
      } catch {
        // silently fall back to defaults
      } finally {
        setCmsLoaded(true);
      }
    };

    // Fetch services
    const fetchServices = async () => {
      try {
        const categories = await serviceService.getCategories();
        const dataRecoveryCat = categories.find(
          (c) => c.slug === 'data-recovery' || c.name.toLowerCase().includes('data recovery')
        );
        const params: Record<string, unknown> = { per_page: 10 };
        if (dataRecoveryCat) params.category_id = dataRecoveryCat.id;
        const response = await serviceService.getAll(params);
        setDataRecoveryServices(response.data || []);
      } catch {
        // ignore
      } finally {
        setLoadingServices(false);
      }
    };

    // Fetch FAQs
    const fetchFaqs = async () => {
      try {
        const response = await apiClient.get('/public/faqs');
        const data = response.data.data;
        const allFaqs: Faq[] = Array.isArray(data)
          ? data
          : (Object.values(data) as Faq[][]).flat();
        setFaqs(allFaqs);
      } catch {
        // ignore
      } finally {
        setFaqsLoading(false);
      }
    };

    fetchCms();
    fetchServices();
    fetchFaqs();
  }, []);

  // Until the /public/data-recovery request settles we don't know whether the
  // CMS has overrides, so showing the hardcoded DEFAULT_* content would cause
  // a visible text swap once the real response arrives. Defer the whole page
  // render to a lightweight skeleton until then.
  if (!cmsLoaded) {
    return (
      <div className="bg-white">
        <div className="relative overflow-hidden bg-gradient-to-br from-ink via-ink to-ink">
          <div className="relative mx-auto max-w-[1800px] px-6 py-8 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto h-8 w-56 bg-white/10 rounded-full animate-pulse mb-6" />
              <div className="mx-auto h-10 w-3/4 bg-white/10 rounded animate-pulse mb-4" />
              <div className="mx-auto h-6 w-1/2 bg-white/10 rounded animate-pulse mb-5" />
              <div className="mx-auto h-4 w-full max-w-2xl bg-white/10 rounded animate-pulse mb-6" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/10 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Resolved section data (CMS value or fallback default)
  const hero      = cms.dr_hero             ?? DEFAULT_HERO;
  const scenarios = cms.dr_loss_scenarios   ?? DEFAULT_SCENARIOS;
  const features  = cms.dr_features         ?? DEFAULT_FEATURES;
  const emergency = cms.dr_emergency_alert  ?? DEFAULT_EMERGENCY;
  const services  = cms.dr_services_section ?? DEFAULT_SERVICES_SECTION;
  const process   = cms.dr_process          ?? DEFAULT_PROCESS;
  const guarantees= cms.dr_guarantees       ?? DEFAULT_GUARANTEES;
  const faqSection= cms.dr_faq_section      ?? DEFAULT_FAQ;
  const cta       = cms.dr_cta              ?? DEFAULT_CTA;

  return (
    <div className="bg-white">
      {/* ── Hero Section ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-ink via-ink to-ink">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative mx-auto max-w-[1800px] px-6 py-8 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/30 rounded-full px-4 py-2 mb-6">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
              <span className="text-sm font-medium text-gray-100">{hero.badge_text}</span>
            </div>

            <h1 className="text-2xl lg:text-xl font-bold mb-6 leading-tight">
              <span className="text-white">{hero.title_line1}</span>
              <br />
              <span className="text-gray-300">{hero.title_line2}</span>
            </h1>

            <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
              {hero.description}
            </p>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(hero.stats ?? []).map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-xl p-4 border border-white/20">
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-gray-300">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={hero.cta1_link}
                className="group flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 shadow-md hover:shadow-lg hover:scale-105 transition-all"
              >
                {hero.cta1_text}
                <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href={`tel:${hero.phone_number}`}
                className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-8 py-4 text-lg font-semibold text-white hover:bg-white/20 transition-all"
              >
                <PhoneIcon className="h-5 w-5" />
                {hero.phone_display}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Data Loss Scenarios ───────────────────────────────────────────────── */}
      <div className="py-8 bg-gray-50">
        <div className="mx-auto max-w-[1800px] px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4">
              {scenarios.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {scenarios.description}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {(scenarios.items ?? []).map((item) => (
              <div key={item.scenario} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-sm font-semibold text-gray-900">{item.scenario}</div>
                <div className="flex items-center gap-1 mt-2 text-gray-700 text-xs">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Recoverable</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features / Specialized Recovery Services ──────────────────────────── */}
      <div className="py-8 sm:py-32 bg-white">
        <div className="mx-auto max-w-[1800px] px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-6">
            <h2 className="text-base font-semibold leading-7 bg-gradient-to-r from-ink to-ink bg-clip-text text-transparent mb-3">
              {features.label}
            </h2>
            <p className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {features.title}
            </p>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              {features.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(features.items ?? []).map((feature) => {
              const IconComponent = resolveIcon(feature.icon);
              return (
                <div
                  key={feature.name}
                  className="group relative bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-500 transition-all hover:-translate-y-1"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="rounded-xl bg-gradient-to-br from-ink to-ink p-3 mb-4 group-hover:scale-110 transition-transform">
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                    <div className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                      <ChartBarIcon className="h-3 w-3" />
                      {feature.successRate} Success
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Emergency Alert ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-ink to-ink py-6">
        <div className="mx-auto max-w-[1800px] px-6">
          <div className="flex items-center justify-center gap-4 text-white">
            <div className="flex-shrink-0">
              <div className="animate-pulse">
                <ExclamationTriangleIcon className="h-8 w-8" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold mb-1">{emergency.title}</p>
              <p className="text-sm text-white/90">{emergency.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Services / Pricing ────────────────────────────────────────────────── */}
      <div id="services" className="py-8 sm:py-32 bg-gray-50">
        <div className="mx-auto max-w-[1800px] px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {services.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              {services.description}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-ink text-white px-6 py-3 rounded-full font-semibold">
              <ShieldCheckIcon className="h-5 w-5" />
              {services.guarantee_badge}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {loadingServices ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-none w-[calc(50%_-_0.75rem)] md:w-[calc(33.333%_-_1rem)] lg:w-[calc(25%_-_1rem)] animate-pulse bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <div className="aspect-[4/3] bg-gray-200 rounded-lg mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-6 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-9 bg-gray-200 rounded-lg" />
                </div>
              ))
            ) : dataRecoveryServices.length > 0 ? (
              dataRecoveryServices.map((service) => (
                <div
                  key={service.id}
                  className="flex-none w-[calc(50%_-_0.75rem)] md:w-[calc(33.333%_-_1rem)] lg:w-[calc(25%_-_1rem)] group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-gray-500 hover:shadow-lg transition-all duration-300"
                >
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-200 to-red-50 overflow-hidden flex items-center justify-center">
                    {service.image ? (
                      <img src={getStorageUrl(service.image)} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <WrenchScrewdriverIcon className="h-14 w-14 text-gray-500" />
                    )}
                    {service.is_active && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        <CheckIcon className="h-3 w-3" />Available
                      </div>
                    )}
                    {service.category && (
                      <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-700">
                        {service.category.name}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem]">{service.name}</h3>
                    <div
                      className="text-xs text-gray-600 leading-snug line-clamp-2 prose prose-xs max-w-none mb-2"
                      dangerouslySetInnerHTML={{ __html: service.description ?? '' }}
                    />

                    {service.duration_estimate && (
                      <div className="flex items-center gap-1 text-gray-600 mb-2">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span className="text-xs">{service.duration_estimate}</span>
                      </div>
                    )}

                    <div className="mt-auto pt-2 border-t border-gray-100">
                      <div className="mb-2">
                        <div className="text-[10px] text-gray-500 leading-none">Starting from</div>
                        <div className="flex items-baseline gap-1.5">
                          <div className="text-lg font-bold text-gray-900">
                            ৳{Number(service.discount_price ?? service.base_price).toLocaleString()}
                          </div>
                          {service.discount_price && (
                            <div className="text-[10px] text-gray-400 line-through">
                              ৳{Number(service.base_price).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/services/${service.slug ?? service.id}`}
                        className="block w-full text-center px-3 py-2 rounded-lg text-xs font-bold bg-ink text-white hover:bg-ink/90 transition-all"
                      >
                        Book Now →
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full text-center py-6">
                <p className="text-gray-500 text-lg">No data recovery services available at the moment.</p>
                <Link href="/services" className="mt-4 inline-block text-gray-900 font-semibold hover:underline">
                  Browse All Services →
                </Link>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">Need a custom recovery solution?</p>
            <Link
              href={services.cta_link}
              className="inline-flex items-center gap-2 text-gray-900 font-semibold hover:text-gray-600 transition-colors"
            >
              {services.cta_text}
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Recovery Process ──────────────────────────────────────────────────── */}
      <div id="process" className="py-8 sm:py-32 bg-gradient-to-b from-white to-gray-50">
        <div className="mx-auto max-w-[1800px] px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full px-4 py-2 mb-4">
              <ClockIcon className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">{process.badge_text}</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {process.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {process.description}
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-400 via-orange-400 to-green-400"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
              {(process.steps ?? []).map((step, index) => {
                const IconComponent = resolveIcon(step.icon);
                return (
                  <div key={step.step} className="flex flex-col items-center text-center">
                    <div className={`relative mb-6 w-24 h-24 rounded-full bg-gradient-to-br ${step.color} p-1 shadow-md`}>
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                        <IconComponent className="h-10 w-10 text-gray-700" />
                      </div>
                      <div className={`absolute -top-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                        {step.step}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-600 mb-4 leading-relaxed">{step.description}</p>

                    <div className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                      <ClockIcon className="h-4 w-4" />
                      {step.time}
                    </div>

                    {index < process.steps.length - 1 && (
                      <div className="lg:hidden mt-6 text-gray-300">
                        <ArrowRightIcon className="h-8 w-8 rotate-90 mx-auto" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Process CTA */}
          <div className="mt-8 text-center">
            <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl p-8 max-w-3xl mx-auto border border-purple-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{process.cta_heading}</h3>
              <p className="text-gray-600 mb-6">{process.cta_description}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={process.cta_btn_link}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
                >
                  {process.cta_btn_text}
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <a
                  href={`tel:${process.cta_phone}`}
                  className="inline-flex items-center justify-center gap-2 bg-white border-2 border-purple-500 text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all"
                >
                  <PhoneIcon className="h-5 w-5" />
                  {process.cta_phone_text}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Guarantees ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-8 sm:py-32">
        <div className="mx-auto max-w-[1800px] px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {guarantees.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {guarantees.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {(guarantees.items ?? []).map((item, index) => {
              const IconComponent = resolveIcon(item.icon);
              const gradients = [
                'from-ink to-ink',
                'from-gray-700 to-ink',
                'from-gray-600 to-gray-700',
              ];
              return (
                <div key={index} className="group bg-white rounded-xl p-8 shadow-lg border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all">
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${gradients[index % gradients.length]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                      <IconComponent className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Why Choose block */}
          <div className="bg-gradient-to-r from-gray-700 to-ink rounded-3xl p-5 sm:p-8 md:p-12">
            <div className="text-center mb-5">
              <h3 className="text-2xl font-bold text-white mb-4">{guarantees.why_title}</h3>
              <p className="text-gray-200 text-lg">{guarantees.why_description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(guarantees.benefits ?? []).map((benefit, index) => (
                <div key={index} className="bg-white/10 rounded-xl p-6 border border-white/20">
                  <div className="text-xl mb-3">{benefit.emoji}</div>
                  <h4 className="text-white font-bold mb-2">{benefit.title}</h4>
                  <p className="text-gray-200 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ Section ───────────────────────────────────────────────────────── */}
      <div className="py-8 bg-white">
        <div className="mx-auto max-w-[1800px] px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {faqSection.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              {faqSection.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {faqsLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6 border border-gray-200 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              ))
            ) : faqs.length === 0 ? (
              <div className="col-span-2 text-center py-6 text-gray-500">
                No FAQs available at the moment.
              </div>
            ) : (
              faqs.map((faq) => (
                <div key={faq.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-start gap-2">
                    <span className="text-gray-700 shrink-0">Q:</span>
                    <span>{faq.question}</span>
                  </h3>
                  <p className="text-gray-600 ml-6">{faq.answer}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-ink via-ink to-black">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative px-6 py-8 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-6 py-2 mb-6">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-sm font-semibold text-white">{cta.badge_text}</span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-white mb-6 leading-tight">
              {cta.title.split('\n').map((line, i) => (
                <span key={i}>{line}{i < cta.title.split('\n').length - 1 && <br />}</span>
              ))}
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-200 mb-6 leading-relaxed">
              {cta.description}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
              <a
                href={`tel:${cta.phone}`}
                className="group flex items-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-white/20 hover:scale-105 transition-all"
              >
                <PhoneIcon className="h-6 w-6" />
                <div className="text-left">
                  <div className="text-xs text-gray-500">{cta.phone_label}</div>
                  <div>{cta.phone_display}</div>
                </div>
              </a>
              <Link
                href={cta.link_href}
                className="flex items-center gap-2 bg-white/10 border-2 border-white/30 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all"
              >
                {cta.link_text}
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-white/90 text-sm">
              {(cta.trust_indicators ?? []).map((indicator) => (
                <div key={indicator} className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-white" />
                  <span>{indicator}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
