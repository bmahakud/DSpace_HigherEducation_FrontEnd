import { Pipe, PipeTransform } from '@angular/core';

/**
 * Finds a property value from an array of objects by matching a key.
 *
 * Usage in template:
 *   {{ branches | dsFind: 'code' : selectedBranch : 'label' }}
 *
 * Equivalent to: branches.find(b => b.code === selectedBranch)?.label
 */
@Pipe({
  name: 'dsFind',
  standalone: true,
})
export class DsFindPipe implements PipeTransform {
  transform(array: any[], keyField: string, keyValue: any, returnField: string): any {
    if (!array || !keyValue) { return ''; }
    const found = array.find(item => item[keyField] === keyValue);
    return found ? found[returnField] : '';
  }
}