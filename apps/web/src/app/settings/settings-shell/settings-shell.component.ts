import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface SettingsNavItem {
  path: string;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {
  // Para adicionar uma nova página: crie a sub-rota em settings.routes.ts e inclua o item aqui.
  readonly items: SettingsNavItem[] = [
    { path: 'perfil', label: 'Perfil', hint: 'Seus dados e alçada' },
    { path: 'empresa', label: 'Empresa', hint: 'CNPJ, endereço e departamentos' },
    { path: 'seguranca', label: 'Segurança', hint: 'Senha e acesso' },
  ];
}
