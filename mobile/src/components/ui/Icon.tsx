import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { ICONS, IconName } from '../../design/icons';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#E8F0FA',
  strokeWidth = 1.8,
}) => {
  const pathData = ICONS[name];
  const paths = pathData.split(' M ').map((p, i) => (i === 0 ? p : 'M ' + p));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((p, i) => (
        <Path
          key={i}
          d={p}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
};
