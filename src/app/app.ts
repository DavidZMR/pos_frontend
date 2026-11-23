import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PosToastOutlet } from './shared/ui/toast/toast-outlet';

@Component({
  imports: [RouterOutlet, PosToastOutlet],
  selector: 'pos-root',
  template: '<router-outlet /><pos-toast-outlet />',
})
export class App {}
