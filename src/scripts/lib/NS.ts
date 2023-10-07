import { NS } from '@ns';

export class ns {
  static ns:NS
}

export function InitializeNS(nsFromMain:NS) {
  ns.ns = nsFromMain
}