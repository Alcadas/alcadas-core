import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private http = inject(HttpClient);
  protected status = signal('verificando...');

  ngOnInit() {
    this.http.get('http://localhost:3000/api/status', {responseType:'text'}).subscribe({
      next: (data) => this.status.set(data),
      error: () => this.status.set('API fora do ar'),
    });
  }
}