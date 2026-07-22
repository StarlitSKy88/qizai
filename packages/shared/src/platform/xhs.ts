import { BasePlatformAdapter } from './base';

export class XHSAdapter extends BasePlatformAdapter {
  get platformName(): string {
    return 'xhs';
  }
}
