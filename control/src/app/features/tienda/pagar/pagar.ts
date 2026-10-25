// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TiendaService } from '../../../core/services/tienda.service';
import { PedidoTienda } from '../../../core/models/pedido-tienda.model';

// ── DECORADOR ────────────────────────────────
// Pantalla que abre el QR del pedido: simula la billetera del cliente
// (no hay una pasarela de pago real). Al confirmar, la API marca el
// pedido como pagado y la pantalla del pedido se actualiza sola.
@Component({
  selector: 'app-pagar',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './pagar.html',
  styleUrl: './pagar.css'
})
export class PagarComponent implements OnInit {

  private route  = inject(ActivatedRoute);
  private tienda = inject(TiendaService);
  private cdr    = inject(ChangeDetectorRef);

  pedido: PedidoTienda | null = null;
  error = '';
  pagando = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.tienda.getPedido(id).subscribe({
      next: (pedido) => { this.pedido = pedido; this.cdr.detectChanges(); },
      error: () => { this.error = 'No encontramos el pedido de este QR.'; this.cdr.detectChanges(); },
    });
  }

  confirmar(): void {
    if (!this.pedido) return;
    this.pagando = true;
    this.tienda.pagar(this.pedido._id).subscribe({
      next: (pedido) => { this.pedido = pedido; this.pagando = false; this.cdr.detectChanges(); },
      error: (err: HttpErrorResponse) => {
        this.pagando = false;
        this.error = err.error?.error ?? 'No se pudo realizar el pago.';
        this.cdr.detectChanges();
      },
    });
  }
}
