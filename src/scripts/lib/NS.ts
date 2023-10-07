import { NS } from '@ns';

export { NS }

export class ns {
  static ns:NS
}


export function InitializeNS(nsFromMain:NS) {
  ns.ns = nsFromMain
}