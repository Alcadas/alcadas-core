import { Component, HostListener, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DrawerBadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface DrawerBadge {
  text: string;
  variant?: DrawerBadgeVariant;
}

@Component({
  selector: 'app-right-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './right-drawer.component.html',
  styleUrl: './right-drawer.component.scss',
})
export class RightDrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly subtitle = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly width = input<string>('540px');
  readonly showClose = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly positionMode = input<'contained' | 'fixed'>('contained');
  readonly badge = input<DrawerBadge | undefined>(undefined);

  readonly closed = output<void>();

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.closed.emit();
    }
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.closed.emit();
    }
  }
}
