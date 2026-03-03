import { TextVariant } from '@mantine/core';

type ExtendedTextVariant = TextVariant | 'subheading';

declare module '@mantine/core' {
  export interface TextProps {
    variant?: ExtendedTextVariant;
  }
}