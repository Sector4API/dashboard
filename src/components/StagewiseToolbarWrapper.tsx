'use client';

import { StagewiseToolbar } from '@stagewise/toolbar-next';

const stagewiseConfig = {
  plugins: [
    {
      name: 'component-info',
      description: 'Provides component information for AI assistance',
      shortInfoForPrompt: () => {
        return "This element is part of the application's component structure";
      },
      mcp: null,
      actions: [
        {
          name: 'Analyze Component',
          description: 'Get AI analysis of this component',
          execute: () => {
            // console.log('Analyzing component structure...');
          },
        },
      ],
    },
    {
      name: 'style-helper',
      description: 'Helps with styling and layout',
      shortInfoForPrompt: () => {
        return "Contains styling and layout information for the selected element";
      },
      mcp: null,
      actions: [
        {
          name: 'Get Style Info',
          description: 'Show computed styles',
          execute: () => {
            // console.log('Fetching style information...');
          },
        },
      ],
    }
  ]
};

export default function StagewiseToolbarWrapper() {
  return <StagewiseToolbar config={stagewiseConfig} />;
} 