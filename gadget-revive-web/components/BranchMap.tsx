'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BranchLocation } from '@/lib/api/branchLocation';

// Inline SVG marker — avoids three unpkg.com requests per map instance and
// the related mobile-network blocking that slowed map mount on 3G/4G.
const markerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
  <path fill="#111827" stroke="#ffffff" stroke-width="1.5"
    d="M14 1C7.4 1 2 6.4 2 13c0 8.4 12 26 12 26s12-17.6 12-26c0-6.6-5.4-12-12-12z"/>
  <circle cx="14" cy="13" r="4.5" fill="#ffffff"/>
</svg>`;

const defaultIcon = L.divIcon({
  className: 'branch-map-marker',
  html: markerSvg,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
});

interface BranchMapProps {
  branches: BranchLocation[];
  mainBranch: BranchLocation | null;
}

// Default center: Dhaka
const DHAKA_CENTER: [number, number] = [23.7904, 90.4071];

export default function BranchMap({ branches, mainBranch }: BranchMapProps) {
  const locatedBranches = branches.filter((b) => b.latitude && b.longitude);

  const center: [number, number] =
    mainBranch?.latitude && mainBranch?.longitude
      ? [mainBranch.latitude, mainBranch.longitude]
      : locatedBranches[0]?.latitude && locatedBranches[0]?.longitude
      ? [locatedBranches[0].latitude as number, locatedBranches[0].longitude as number]
      : DHAKA_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locatedBranches.map((branch) => (
        <Marker
          key={branch.id}
          position={[branch.latitude as number, branch.longitude as number]}
          icon={defaultIcon}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{branch.name}</p>
              <p className="text-gray-600">{branch.address}</p>
              <p className="text-gray-900">{branch.phone}</p>
              {branch.map_url && (
                <a
                  href={branch.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Get directions
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
