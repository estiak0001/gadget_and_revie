'use client';

import { useState, useEffect } from 'react';
import { locationService } from '@/lib/api';
import { Division, District, Area } from '@/lib/types';

interface LocationSelectorProps {
  divisionId: number;
  districtId: number;
  areaId: number;
  onDivisionChange: (id: number) => void;
  onDistrictChange: (id: number) => void;
  onAreaChange: (id: number) => void;
  required?: boolean;
  disabled?: boolean;
}

export default function LocationSelector({
  divisionId,
  districtId,
  areaId,
  onDivisionChange,
  onDistrictChange,
  onAreaChange,
  required = false,
  disabled = false,
}: LocationSelectorProps) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState({
    divisions: false,
    districts: false,
    areas: false,
  });

  useEffect(() => {
    loadDivisions();
  }, []);

  useEffect(() => {
    if (divisionId) {
      loadDistricts(divisionId);
    }
  }, [divisionId]);

  useEffect(() => {
    if (districtId) {
      loadAreas(districtId);
    }
  }, [districtId]);

  const loadDivisions = async () => {
    try {
      setLoading((prev) => ({ ...prev, divisions: true }));
      const data = await locationService.getDivisions();
      setDivisions(data);
    } catch (error) {
      console.error('Failed to load divisions:', error);
    } finally {
      setLoading((prev) => ({ ...prev, divisions: false }));
    }
  };

  const loadDistricts = async (divId: number) => {
    try {
      setLoading((prev) => ({ ...prev, districts: true }));
      const data = await locationService.getDistricts(divId);
      setDistricts(data);
    } catch (error) {
      console.error('Failed to load districts:', error);
    } finally {
      setLoading((prev) => ({ ...prev, districts: false }));
    }
  };

  const loadAreas = async (distId: number) => {
    try {
      setLoading((prev) => ({ ...prev, areas: true }));
      const data = await locationService.getAreas(distId);
      setAreas(data);
    } catch (error) {
      console.error('Failed to load areas:', error);
    } finally {
      setLoading((prev) => ({ ...prev, areas: false }));
    }
  };

  const handleDivisionChange = (id: number) => {
    onDivisionChange(id);
    setDistricts([]);
    setAreas([]);
    onDistrictChange(0);
    onAreaChange(0);
  };

  const handleDistrictChange = (id: number) => {
    onDistrictChange(id);
    setAreas([]);
    onAreaChange(0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Division {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={divisionId}
          onChange={(e) => handleDivisionChange(Number(e.target.value))}
          required={required}
          disabled={disabled || loading.divisions}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-ink focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="0">
            {loading.divisions ? 'Loading...' : 'Select Division'}
          </option>
          {divisions.map((division) => (
            <option key={division.id} value={division.id}>
              {division.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          District {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={districtId}
          onChange={(e) => handleDistrictChange(Number(e.target.value))}
          required={required}
          disabled={disabled || !divisionId || loading.districts}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-ink focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="0">
            {loading.districts ? 'Loading...' : 'Select District'}
          </option>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Area {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={areaId}
          onChange={(e) => onAreaChange(Number(e.target.value))}
          required={required}
          disabled={disabled || !districtId || loading.areas}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-ink focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="0">
            {loading.areas ? 'Loading...' : 'Select Area'}
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
