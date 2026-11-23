import { Pipe, type PipeTransform } from '@angular/core';
import { formatMoney } from '../utils/format';

/** `{{ product.salePriceCents | money }}` → "$289.00" */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    return formatMoney(cents);
  }
}
