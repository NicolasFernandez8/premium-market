// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth.service';
import { TiendaService } from '../../../core/services/tienda.service';
import { ESTADOS_PEDIDO, PedidoTienda } from '../../../core/models/pedido-tienda.model';

// ── DECORADOR ────────────────────────────────
// Cuenta del cliente: tipo de cliente, descuento y historial de pedidos.
@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './mi-cuenta.html',
  styleUrls: ['../../admin/pedidos/pedidos.css', '../pedido/pedido.css']
})
export class MiCuentaComponent implements OnInit {

  private tienda = inject(TiendaService);
  private cdr    = inject(ChangeDetectorRef);

  usuario = inject(AuthService).obtenerUsuario();
  config$ = this.tienda.config$;
  estados = ESTADOS_PEDIDO;

  pedidos: PedidoTienda[] = [];
  cargando = true;
  error = false;
  expandido = '';

  // Lo gastado y ahorrado en pedidos no cancelados
  get resumen() {
    const validos = this.pedidos.filter(p => p.estado !== 'cancelado' && p.estado !== 'pendiente_pago');
    return {
      compras:  validos.length,
      gastado:  validos.reduce((a, p) => a + p.total, 0),
      ahorrado: validos.reduce((a, p) => a + p.ahorroOfertas + p.ahorroPromos + p.ahorroCliente, 0),
    };
  }

  ngOnInit(): void {
    this.tienda.misPedidos().subscribe({
      next: (pedidos) => { this.pedidos = pedidos; this.cargando = false; this.cdr.detectChanges(); },
      error: () => { this.cargando = false; this.error = true; this.cdr.detectChanges(); },
    });
  }

  alternar(id: string): void {
    this.expandido = this.expandido === id ? '' : id;
  }
}
