import type { Preview } from '@storybook/react';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      defaultViewport: 'desktop',
      viewports: {
        mobile: { name: 'Mobile (375px)', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        tablet: { name: 'Tablet (768px)', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
        desktop: { name: 'Desktop (1280px)', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F3F4F6' },
        { name: 'dark', value: '#0D1B2A' },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Color theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
