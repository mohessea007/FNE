import Image from 'next/image';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ width = 200, height = 200, className = '' }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="CloudFNE Pro Logo"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

