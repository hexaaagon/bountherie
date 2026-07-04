import { PlusIcon as Plus } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';

export function PlusSeparator({
  position,
  main = {},
  child,
}: {
  position: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>;
  main?: React.ComponentProps<typeof Plus>;
  child?: {
    'top-left'?: React.ComponentProps<typeof Plus>;
    'top-right'?: React.ComponentProps<typeof Plus>;
    'bottom-left'?: React.ComponentProps<typeof Plus>;
    'bottom-right'?: React.ComponentProps<typeof Plus>;
  };
}) {
  const { className, size, ...props } = main;

  const { className: tlClassName, size: tlSize, ...tlChild } = child?.['top-left'] || {};
  const { className: trClassName, size: trSize, ...trChild } = child?.['top-right'] || {};
  const { className: blClassName, size: blSize, ...blChild } = child?.['bottom-left'] || {};
  const { className: brClassName, size: brSize, ...brChild } = child?.['bottom-right'] || {};

  return (
    <>
      {position.includes('top-left') && (
        <Plus
          size={tlSize || size || 12}
          className={cn(
            '-top-[6.4px] -left-[6.4px] absolute text-separator',
            className,
            tlClassName,
          )}
          {...props}
          {...tlChild}
        />
      )}
      {position.includes('top-right') && (
        <Plus
          size={trSize || size || 12}
          className={cn(
            '-top-[6.4px] -right-[6.4px] absolute text-separator',
            className,
            trClassName,
          )}
          {...props}
          {...trChild}
        />
      )}
      {position.includes('bottom-left') && (
        <Plus
          size={blSize || size || 12}
          className={cn(
            '-bottom-[6.4px] -left-[6.4px] absolute text-separator',
            className,
            blClassName,
          )}
          {...props}
          {...blChild}
        />
      )}
      {position.includes('bottom-right') && (
        <Plus
          size={brSize || size || 12}
          className={cn(
            '-bottom-[6.4px] -right-[6.4px] absolute text-separator',
            className,
            brClassName,
          )}
          {...props}
          {...brChild}
        />
      )}
    </>
  );
}
