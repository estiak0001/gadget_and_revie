'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

// Full list of all Heroicons (24/outline)
const ICON_NAMES: string[] = [
  'AcademicCapIcon','AdjustmentsHorizontalIcon','AdjustmentsVerticalIcon',
  'ArchiveBoxArrowDownIcon','ArchiveBoxXMarkIcon','ArchiveBoxIcon',
  'ArrowDownCircleIcon','ArrowDownLeftIcon','ArrowDownOnSquareStackIcon',
  'ArrowDownOnSquareIcon','ArrowDownRightIcon','ArrowDownTrayIcon','ArrowDownIcon',
  'ArrowLeftCircleIcon','ArrowLeftEndOnRectangleIcon','ArrowLeftOnRectangleIcon',
  'ArrowLeftStartOnRectangleIcon','ArrowLeftIcon','ArrowLongDownIcon',
  'ArrowLongLeftIcon','ArrowLongRightIcon','ArrowLongUpIcon',
  'ArrowPathRoundedSquareIcon','ArrowPathIcon','ArrowRightCircleIcon',
  'ArrowRightEndOnRectangleIcon','ArrowRightOnRectangleIcon',
  'ArrowRightStartOnRectangleIcon','ArrowRightIcon','ArrowSmallDownIcon',
  'ArrowSmallLeftIcon','ArrowSmallRightIcon','ArrowSmallUpIcon',
  'ArrowTopRightOnSquareIcon','ArrowTrendingDownIcon','ArrowTrendingUpIcon',
  'ArrowTurnDownLeftIcon','ArrowTurnDownRightIcon','ArrowTurnLeftDownIcon',
  'ArrowTurnLeftUpIcon','ArrowTurnRightDownIcon','ArrowTurnRightUpIcon',
  'ArrowTurnUpLeftIcon','ArrowTurnUpRightIcon','ArrowUpCircleIcon',
  'ArrowUpLeftIcon','ArrowUpOnSquareStackIcon','ArrowUpOnSquareIcon',
  'ArrowUpRightIcon','ArrowUpTrayIcon','ArrowUpIcon','ArrowUturnDownIcon',
  'ArrowUturnLeftIcon','ArrowUturnRightIcon','ArrowUturnUpIcon',
  'ArrowsPointingInIcon','ArrowsPointingOutIcon','ArrowsRightLeftIcon',
  'ArrowsUpDownIcon','AtSymbolIcon','BackspaceIcon','BackwardIcon',
  'BanknotesIcon','Bars2Icon','Bars3BottomLeftIcon','Bars3BottomRightIcon',
  'Bars3CenterLeftIcon','Bars3Icon','Bars4Icon','BarsArrowDownIcon',
  'BarsArrowUpIcon','Battery0Icon','Battery100Icon','Battery50Icon',
  'BeakerIcon','BellAlertIcon','BellSlashIcon','BellSnoozeIcon','BellIcon',
  'BoldIcon','BoltSlashIcon','BoltIcon','BookOpenIcon','BookmarkSlashIcon',
  'BookmarkSquareIcon','BookmarkIcon','BriefcaseIcon','BugAntIcon',
  'BuildingLibraryIcon','BuildingOffice2Icon','BuildingOfficeIcon',
  'BuildingStorefrontIcon','CakeIcon','CalculatorIcon','CalendarDateRangeIcon',
  'CalendarDaysIcon','CalendarIcon','CameraIcon','ChartBarSquareIcon',
  'ChartBarIcon','ChartPieIcon','ChatBubbleBottomCenterTextIcon',
  'ChatBubbleBottomCenterIcon','ChatBubbleLeftEllipsisIcon',
  'ChatBubbleLeftRightIcon','ChatBubbleLeftIcon','ChatBubbleOvalLeftEllipsisIcon',
  'ChatBubbleOvalLeftIcon','CheckBadgeIcon','CheckCircleIcon','CheckIcon',
  'ChevronDoubleDownIcon','ChevronDoubleLeftIcon','ChevronDoubleRightIcon',
  'ChevronDoubleUpIcon','ChevronDownIcon','ChevronLeftIcon','ChevronRightIcon',
  'ChevronUpDownIcon','ChevronUpIcon','CircleStackIcon',
  'ClipboardDocumentCheckIcon','ClipboardDocumentListIcon',
  'ClipboardDocumentIcon','ClipboardIcon','ClockIcon','CloudArrowDownIcon',
  'CloudArrowUpIcon','CloudIcon','CodeBracketSquareIcon','CodeBracketIcon',
  'Cog6ToothIcon','Cog8ToothIcon','CogIcon','CommandLineIcon',
  'ComputerDesktopIcon','CpuChipIcon','CreditCardIcon','CubeTransparentIcon',
  'CubeIcon','CurrencyBangladeshiIcon','CurrencyDollarIcon','CurrencyEuroIcon',
  'CurrencyPoundIcon','CurrencyRupeeIcon','CurrencyYenIcon',
  'CursorArrowRaysIcon','CursorArrowRippleIcon','DevicePhoneMobileIcon',
  'DeviceTabletIcon','DivideIcon','DocumentArrowDownIcon','DocumentArrowUpIcon',
  'DocumentChartBarIcon','DocumentCheckIcon','DocumentCurrencyBangladeshiIcon',
  'DocumentCurrencyDollarIcon','DocumentCurrencyEuroIcon',
  'DocumentCurrencyPoundIcon','DocumentCurrencyRupeeIcon',
  'DocumentCurrencyYenIcon','DocumentDuplicateIcon','DocumentMagnifyingGlassIcon',
  'DocumentMinusIcon','DocumentPlusIcon','DocumentTextIcon','DocumentIcon',
  'EllipsisHorizontalCircleIcon','EllipsisHorizontalIcon','EllipsisVerticalIcon',
  'EnvelopeOpenIcon','EnvelopeIcon','EqualsIcon','ExclamationCircleIcon',
  'ExclamationTriangleIcon','EyeDropperIcon','EyeSlashIcon','EyeIcon',
  'FaceFrownIcon','FaceSmileIcon','FilmIcon','FingerPrintIcon','FireIcon',
  'FlagIcon','FolderArrowDownIcon','FolderMinusIcon','FolderOpenIcon',
  'FolderPlusIcon','FolderIcon','ForwardIcon','FunnelIcon','GifIcon',
  'GiftTopIcon','GiftIcon','GlobeAltIcon','GlobeAmericasIcon',
  'GlobeAsiaAustraliaIcon','GlobeEuropeAfricaIcon','H1Icon','H2Icon','H3Icon',
  'HandRaisedIcon','HandThumbDownIcon','HandThumbUpIcon','HashtagIcon',
  'HeartIcon','HomeModernIcon','HomeIcon','IdentificationIcon',
  'InboxArrowDownIcon','InboxStackIcon','InboxIcon','InformationCircleIcon',
  'ItalicIcon','KeyIcon','LanguageIcon','LifebuoyIcon','LightBulbIcon',
  'LinkSlashIcon','LinkIcon','ListBulletIcon','LockClosedIcon','LockOpenIcon',
  'MagnifyingGlassCircleIcon','MagnifyingGlassMinusIcon',
  'MagnifyingGlassPlusIcon','MagnifyingGlassIcon','MapPinIcon','MapIcon',
  'MegaphoneIcon','MicrophoneIcon','MinusCircleIcon','MinusSmallIcon',
  'MinusIcon','MoonIcon','MusicalNoteIcon','NewspaperIcon','NoSymbolIcon',
  'NumberedListIcon','PaintBrushIcon','PaperAirplaneIcon','PaperClipIcon',
  'PauseCircleIcon','PauseIcon','PencilSquareIcon','PencilIcon',
  'PercentBadgeIcon','PhoneArrowDownLeftIcon','PhoneArrowUpRightIcon',
  'PhoneXMarkIcon','PhoneIcon','PhotoIcon','PlayCircleIcon','PlayPauseIcon',
  'PlayIcon','PlusCircleIcon','PlusSmallIcon','PlusIcon','PowerIcon',
  'PresentationChartBarIcon','PresentationChartLineIcon','PrinterIcon',
  'PuzzlePieceIcon','QrCodeIcon','QuestionMarkCircleIcon','QueueListIcon',
  'RadioIcon','ReceiptPercentIcon','ReceiptRefundIcon','RectangleGroupIcon',
  'RectangleStackIcon','RocketLaunchIcon','RssIcon','ScaleIcon','ScissorsIcon',
  'ServerStackIcon','ServerIcon','ShareIcon','ShieldCheckIcon',
  'ShieldExclamationIcon','ShoppingBagIcon','ShoppingCartIcon','SignalSlashIcon',
  'SignalIcon','SlashIcon','SparklesIcon','SpeakerWaveIcon','SpeakerXMarkIcon',
  'Square2StackIcon','Square3Stack3DIcon','Squares2X2Icon','SquaresPlusIcon',
  'StarIcon','StopCircleIcon','StopIcon','StrikethroughIcon','SunIcon',
  'SwatchIcon','TableCellsIcon','TagIcon','TicketIcon','TrashIcon','TrophyIcon',
  'TruckIcon','TvIcon','UnderlineIcon','UserCircleIcon','UserGroupIcon',
  'UserMinusIcon','UserPlusIcon','UserIcon','UsersIcon','VariableIcon',
  'VideoCameraSlashIcon','VideoCameraIcon','ViewColumnsIcon',
  'ViewfinderCircleIcon','WalletIcon','WifiIcon','WindowIcon',
  'WrenchScrewdriverIcon','WrenchIcon','XCircleIcon','XMarkIcon',
];

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
}

export default function IconPicker({ value, onChange, label = 'Icon' }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_NAMES;
    const q = search.toLowerCase().replace(/icon$/i, '').trim();
    return ICON_NAMES.filter(name =>
      name.toLowerCase().replace(/icon$/i, '').includes(q)
    );
  }, [search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const SelectedIcon = value ? (HeroIcons as Record<string, unknown>)[value] as React.FC<React.SVGProps<SVGSVGElement>> | undefined : undefined;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center gap-3 px-3 py-2 border border-gray-300 rounded-lg bg-white text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
      >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-gray-100">
          {SelectedIcon ? (
            <SelectedIcon className="w-5 h-5 text-gray-700" />
          ) : (
            <span className="text-gray-400 text-xs">?</span>
          )}
        </div>
        <span className="flex-1 text-sm truncate text-gray-700">
          {value || 'Select an icon…'}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 text-gray-400"
            title="Clear icon"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[340px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search icons…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">{filtered.length} icons</p>
          </div>

          {/* Grid */}
          <div className="overflow-y-auto max-h-72 p-2">
            <div className="grid grid-cols-6 gap-1">
              {filtered.map((name) => {
                const Icon = (HeroIcons as Record<string, unknown>)[name] as React.FC<React.SVGProps<SVGSVGElement>>;
                const isSelected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name.replace(/Icon$/, '')}
                    onClick={() => { onChange(name); setIsOpen(false); setSearch(''); }}
                    className={`relative flex items-center justify-center w-full aspect-square rounded-lg transition-all ${
                      isSelected
                        ? 'bg-primary-100 ring-2 ring-primary-500 text-primary-700'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <p className="text-center py-8 text-sm text-gray-400">No icons match &quot;{search}&quot;</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
