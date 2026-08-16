'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import {
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  TrophyIcon,
  CheckBadgeIcon,
  RocketLaunchIcon,
  ComputerDesktopIcon,
  CircleStackIcon,
  CpuChipIcon,
  CubeIcon,
  ServerIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  PhoneIcon,
  ChartBarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { cmsService } from '@/lib/api/cms';
import type {
  AboutPageCmsData,
  AboutHero,
  AboutServices,
  AboutStory,
  AboutStats,
  AboutValues,
  AboutMission,
  AboutVision,
  AboutTeam,
  AboutCta,
} from '@/lib/api/cms';

// ── Icon map ──────────────────────────────────────────────────────────────────

type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

const ICON_MAP: Record<string, HeroIconComponent> = {
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  TrophyIcon,
  CheckBadgeIcon,
  RocketLaunchIcon,
  ComputerDesktopIcon,
  CircleStackIcon,
  CpuChipIcon,
  CubeIcon,
  ServerIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  LockClosedIcon,
  PhoneIcon,
  ChartBarIcon,
  CheckCircleIcon,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const Component = ICON_MAP[name] ?? CpuChipIcon;
  return <Component className={className} />;
}

// ── Fallback defaults (mirrors the seeder, keeps page working before DB seed) ─

const DEFAULT_HERO: AboutHero = {
  badge_icon: 'CpuChipIcon',
  badge_text: 'Your Trusted Tech Partner',
  title: 'About Gadget Revive',
  subtitle: 'Professional data recovery, PC repair services, and quality computer parts — all under one roof',
};

const DEFAULT_SERVICES: AboutServices = {
  items: [
    { icon: 'CircleStackIcon',    title: 'Data Recovery',         description: 'Advanced recovery from crashed drives, corrupted storage, and deleted files.' },
    { icon: 'ComputerDesktopIcon',title: 'PC Repair & Service',   description: 'Hardware diagnostics, component replacement, and system optimization.' },
    { icon: 'CpuChipIcon',        title: 'Computer Parts',        description: 'Genuine components - CPUs, GPUs, RAM, SSDs, motherboards, and more.' },
    { icon: 'CubeIcon',           title: 'Accessories & Products',description: 'Peripherals, cables, cooling systems, and PC building essentials.' },
  ],
};

const DEFAULT_STORY: AboutStory = {
  badge_icon: 'RocketLaunchIcon',
  badge_text: 'Who We Are',
  heading: 'A New Standard in Computer Services',
  paragraphs: [
    'Gadget Revive is your one-stop destination for all computer-related needs. We specialize in <strong>professional data recovery</strong>, bringing back your valuable files from crashed hard drives, corrupted SSDs, and damaged storage devices.',
    'Our <strong>PC repair services</strong> cover everything from hardware diagnostics and component upgrades to complete system builds. Whether you need a simple RAM upgrade or a complex motherboard replacement, our skilled technicians have you covered.',
    'We also stock a wide range of <strong>genuine computer parts and accessories</strong> — processors, graphics cards, storage drives, peripherals, and more. Quality products, competitive prices, and expert advice.',
  ],
  highlights: [
    { icon: 'CheckBadgeIcon', text: 'Certified Technicians', dark: false },
    { icon: 'ShieldCheckIcon', text: 'Genuine Parts',        dark: true },
  ],
};

const DEFAULT_STATS: AboutStats = {
  items: [
    { icon: 'CircleStackIcon',    value: '95%+',   label: 'Data Recovery Success', dark: false },
    { icon: 'ComputerDesktopIcon',value: '24-72h', label: 'Avg. Repair Time',      dark: true },
    { icon: 'CpuChipIcon',        value: '500+',   label: 'Products in Stock',     dark: true },
    { icon: 'UserGroupIcon',      value: 'Expert', label: 'Tech Support',          dark: false },
  ],
};

const DEFAULT_VALUES: AboutValues = {
  title: 'Why Choose Gadget Revive',
  subtitle: 'Your data and devices are in expert hands',
  items: [
    { icon: 'ShieldCheckIcon', title: 'Genuine Parts Only', description: 'We source authentic components directly from trusted manufacturers.' },
    { icon: 'ClockIcon',       title: 'Quick Service',       description: 'Most repairs and data recovery completed within 24-72 hours.' },
    { icon: 'SparklesIcon',    title: 'Honest Pricing',      description: 'Transparent quotes with no hidden charges. Pay only for what you need.' },
    { icon: 'CheckBadgeIcon',  title: 'Service Warranty',    description: 'All services backed by warranty. Your satisfaction is guaranteed.' },
  ],
};

const DEFAULT_MISSION: AboutMission = {
  icon: 'TrophyIcon',
  title: 'Our Mission',
  text: 'To provide professional data recovery and computer repair services that protect your valuable data and keep your systems running at peak performance. We combine technical expertise with genuine parts to deliver reliable solutions.',
};

const DEFAULT_VISION: AboutVision = {
  icon: 'RocketLaunchIcon',
  title: 'Our Vision',
  text: "To be the most trusted name in computer services — where customers know their data is safe, their devices are in expert hands, and they're getting the best parts available.",
};

const DEFAULT_TEAM: AboutTeam = {
  title: 'Our Expert Team',
  subtitle: 'Skilled professionals ready to solve your tech challenges',
  members: [
    { name: 'Tech Expert',   role: 'Data Recovery Specialist', initials: 'DR' },
    { name: 'Hardware Pro',  role: 'PC Service Engineer',       initials: 'PC' },
    { name: 'Parts Advisor', role: 'Product Specialist',        initials: 'PS' },
  ],
};

const DEFAULT_CTA: AboutCta = {
  title: 'Need Data Recovery or PC Service?',
  text: "Get in touch for a free consultation. We'll diagnose your issue and provide a transparent quote — no obligation.",
  buttons: [
    { icon: 'CircleStackIcon',       label: 'Data Recovery', href: '/data-recovery', variant: 'light' },
    { icon: 'WrenchScrewdriverIcon', label: 'PC Services',   href: '/services',       variant: 'dark' },
    { icon: 'CpuChipIcon',           label: 'Shop Parts',    href: '/products',       variant: 'outline' },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [cms, setCms] = useState<AboutPageCmsData>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    cmsService
      .getAboutPageData()
      .then((data) => setCms(data))
      .catch(() => { /* keep empty cms; DEFAULTS will apply below */ })
      .finally(() => setLoaded(true));
  }, []);

  // Hold the JSX tree in a skeleton until we know whether the CMS overrode the
  // defaults. Rendering DEFAULT_* before the fetch resolves would flash demo
  // copy that the admin has overwritten.
  if (!loaded) {
    return (
      <div className="bg-white">
        <section className="relative bg-gradient-to-br from-ink via-black to-ink overflow-hidden">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 lg:py-6 relative">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto h-8 w-48 bg-white/10 rounded-full animate-pulse mb-6" />
              <div className="mx-auto h-10 w-3/4 bg-white/10 rounded animate-pulse mb-4" />
              <div className="mx-auto h-6 w-1/2 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </section>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hero     = cms.about_hero     ?? DEFAULT_HERO;
  const services = cms.about_services ?? DEFAULT_SERVICES;
  const story    = cms.about_story    ?? DEFAULT_STORY;
  const stats    = cms.about_stats    ?? DEFAULT_STATS;
  const values   = cms.about_values   ?? DEFAULT_VALUES;
  const mission  = cms.about_mission  ?? DEFAULT_MISSION;
  const vision   = cms.about_vision   ?? DEFAULT_VISION;
  const team     = cms.about_team     ?? DEFAULT_TEAM;
  const cta      = cms.about_cta      ?? DEFAULT_CTA;

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-ink via-black to-ink overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/circuit-pattern.svg')] opacity-5"></div>
        <div className="hidden md:block absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="hidden md:block absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl"></div>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 lg:py-6 relative">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6">
              <Icon name={hero.badge_icon} className="h-5 w-5 text-gray-300 mr-2" />
              <span className="text-sm text-gray-300">{hero.badge_text}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4">{hero.title}</h1>
            <p className="text-base sm:text-xl text-gray-300 max-w-2xl mx-auto">{hero.subtitle}</p>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="relative -mt-4 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4">
            {services.items.map((service) => (
              <div key={service.title} className="text-center group">
                <div className="w-14 h-14 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-ink transition-all">
                  <Icon name={service.icon} className="h-7 w-7 text-gray-700 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{service.title}</h3>
                <p className="text-xs text-gray-500">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-6 sm:py-7 lg:py-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-5 lg:gap-6 items-center">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-ink text-white mb-4">
                <Icon name={story.badge_icon} className="h-4 w-4 mr-1" />
                {story.badge_text}
              </span>
              <h2 className="text-2xl sm:text-2xl font-bold text-gray-900 mb-4">{story.heading}</h2>
              {story.paragraphs.map((para, i) => (
                <p
                  key={i}
                  className={`text-gray-600 ${i < story.paragraphs.length - 1 ? 'mb-4' : 'mb-6'}`}
                  dangerouslySetInnerHTML={{ __html: para }}
                />
              ))}
              <div className="flex flex-wrap gap-4">
                {story.highlights.map((h) => (
                  <div
                    key={h.text}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                      h.dark ? 'bg-ink' : 'bg-gray-100'
                    }`}
                  >
                    <Icon name={h.icon} className={`h-5 w-5 ${h.dark ? 'text-white' : 'text-gray-700'}`} />
                    <span className={`text-sm font-medium ${h.dark ? 'text-white' : 'text-gray-800'}`}>
                      {h.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="relative">
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-8">
                <div className="grid grid-cols-2 gap-4">
                  {stats.items.map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-xl p-6 shadow-sm text-center ${
                        stat.dark
                          ? 'bg-ink'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <Icon
                        name={stat.icon}
                        className={`h-8 w-8 mx-auto mb-2 ${stat.dark ? 'text-white' : 'text-gray-800'}`}
                      />
                      <p className={`text-2xl font-bold ${stat.dark ? 'text-white' : 'text-gray-900'}`}>
                        {stat.value}
                      </p>
                      <p className={`text-xs ${stat.dark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{values.title}</h2>
            <p className="text-gray-600 max-w-xl mx-auto">{values.subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.items.map((value) => (
              <div
                key={value.title}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="w-12 h-12 bg-ink rounded-lg flex items-center justify-center mb-4">
                  <Icon name={value.icon} className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-5">
            {/* Mission */}
            <div className="bg-ink rounded-xl p-8 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Icon name={mission.icon} className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">{mission.title}</h3>
              <p className="text-gray-300">{mission.text}</p>
            </div>
            {/* Vision */}
            <div className="bg-white border-2 border-ink rounded-xl p-8">
              <div className="w-12 h-12 bg-ink rounded-lg flex items-center justify-center mb-4">
                <Icon name={vision.icon} className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{vision.title}</h3>
              <p className="text-gray-600">{vision.text}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{team.title}</h2>
            <p className="text-gray-600 max-w-xl mx-auto">{team.subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
            {team.members.map((member) => (
              <div key={member.name} className="text-center">
                <div className="w-20 h-20 mx-auto bg-ink rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-xl font-bold text-white">{member.initials}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-500">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 bg-ink">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-2xl font-bold text-white mb-4">{cta.title}</h2>
          <p className="text-gray-300 mb-5 max-w-xl mx-auto">{cta.text}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {cta.buttons.map((btn) => {
              const variantClass =
                btn.variant === 'light'
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : btn.variant === 'dark'
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'border-2 border-white text-white hover:bg-white hover:text-gray-900';
              return (
                <Link
                  key={btn.label}
                  href={btn.href}
                  className={`inline-flex items-center justify-center px-6 py-3 font-semibold rounded-lg transition-colors ${variantClass}`}
                >
                  <Icon name={btn.icon} className="h-5 w-5 mr-2" />
                  {btn.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
