import { applyMask as applyDatetimeMask } from '@/infobim/shared/adapter/datetime_mask';
import { applyMask as applyNumberMask } from '@/infobim/shared/adapter/number_mask';

const XSD = 'http://www.w3.org/2001/XMLSchema#';

/** Shows a value with a mask; a value the mask does not understand comes back as it came. */
export type Mask = (value: string, mask: string) => string;

/**
 * The file that applies the masks of each datatype. Several datatypes share a
 * file when one understands them all; a datatype with no entry has no mask
 * here, and the values of its fields are shown as they are.
 */
export const MASK_BY_DATATYPE: Readonly<Record<string, Mask>> = {
  [`${XSD}dateTime`]: applyDatetimeMask,
  [`${XSD}date`]: applyDatetimeMask,
  [`${XSD}time`]: applyDatetimeMask,
  ...Object.fromEntries(
    [
      'integer', 'int', 'long', 'short', 'byte',
      'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger',
      'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte',
      'decimal', 'double', 'float',
    ].map((name) => [`${XSD}${name}`, applyNumberMask]),
  ),
};

/** The mask of a datatype (an IRI), if the table has one. */
export function maskFor(datatype: string | undefined): Mask | undefined {
  return datatype !== undefined && Object.hasOwn(MASK_BY_DATATYPE, datatype) ? MASK_BY_DATATYPE[datatype] : undefined;
}
