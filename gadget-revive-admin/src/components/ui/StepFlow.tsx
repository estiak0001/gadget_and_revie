'use client';

import React from 'react';

interface StepFlowProps {
  steps: string[];
}

/** A numbered step-by-step visual guide, used in the Accounts module's "how to input" help sections. */
const StepFlow: React.FC<StepFlowProps> = ({ steps }) => (
  <ol className="space-y-2">
    {steps.map((step, i) => (
      <li key={i} className="flex items-start gap-3">
        <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
          {i + 1}
        </span>
        <span className="text-gray-700 pt-0.5">{step}</span>
      </li>
    ))}
  </ol>
);

export default StepFlow;
