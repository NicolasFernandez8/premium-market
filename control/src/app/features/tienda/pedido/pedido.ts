// ── IMPORTS BASE ──────────────────────────────
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toDataURL } from 'qrcode';

// ── ANGULAR MATERIAL ──────────────────────────
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

// ── SERVICIOS Y MODELOS ───────────────────────
import { TiendaService } from '../../../core/services/tienda.service';
import { ESTADOS_PEDIDO, EstadoPedido, PedidoTienda } from '../../../core/models/pedido-tienda.model';

const SEGUNDOS_ENTRE_CONSULTAS = 3;

// Pasos que ve el cliente en el seguimiento
const PASOS: EstadoPedido[] = ['pendiente_pago', 'pagado', 'preparando', 'listo', 'entregado'];

// ── DECORADOR ────────────────────────────────
// Pago y seguimiento de un pedido de la tienda.
// Mientras espera el pago muestra el QR (abre /pagar/:id) y consulta
// el estado cada pocos segundos; cuando se acredita, pasa al seguimiento.
@Component({
  selector: 'app-pedido',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './pedido.html',
  styleUrls: ['../../admin/pedidos/pedidos.css', './pedido.css']
})
export class PedidoComponent implements OnInit, OnDestroy {

  private route    = inject(ActivatedRoute);
  private tienda   = inject(TiendaService);
  private cdr      = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);

  pedido: PedidoTienda | null = null;
  error = '';
  qr = '';
  urlPago = '';
  restante = '';        // "29:41" hasta que vence
  estados = ESTADOS_PEDIDO;
  pasos = PASOS;

  private id = '';
  private consulta: ReturnType<typeof setInterval> | undefined;
  private reloj: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.urlPago = `${window.location.origin}/pagar/${this.id}`;
    toDataURL(this.urlPago, { width: 480, margin: 1, color: { dark: '#2A1A35', light: '#FFFFFF' } })
      .then(qr => { this.qr = qr; this.cdr.detectChanges(); });

    this.cargar();
    // Sigue consultando hasta que el servidor confirme un estado final: el pago puede
    // acreditarse justo antes del vencimiento, y un pedido vencido pasa a cancelado solo
    this.consulta = setInterval(() => {
      if (this.pedido && !['entregado', 'cancelado'].includes(this.pedido.estado)) this.cargar();
    }, SEGUNDOS_ENTRE_CONSULTAS * 1000);
    this.reloj = setInterval(() => this.actualizarRestante(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.consulta);
    clearInterval(this.reloj);
  }

  cargar(): void {
    this.tienda.getPedido(this.id).subscribe({
      next: (pedido) => {
        const recienPagado = this.pedido?.estado === 'pendiente_pago' && pedido.estado === 'pagado';
        this.pedido = pedido;
        this.error = '';
        this.actualizarRestante();
        if (recienPagado) {
          this.snackBar.open('¡Pago acreditado! Ya estamos preparando tu pedido.', 'Cerrar', { duration: 4000, panelClass: 'snackbar--success' });
        }
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.status === 404 ? 'No encontramos ese pedido.' : 'No se pudo conectar con el servidor.';
        this.cdr.detectChanges();
      }
    });
  }

  cancelar(): void {
    if (!this.pedido || !confirm('¿Cancelar el pedido? Los productos vuelven a la tienda.')) return;
    this.tienda.cambiarEstado(this.pedido._id, 'cancelado').subscribe({
      next: (pedido) => { this.pedido = pedido; this.cdr.detectChanges(); },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(err.error?.error ?? 'No se pudo cancelar', 'Cerrar', { duration: 3500, panelClass: 'snackbar--error' }),
    });
  }

  // Paso alcanzado en la línea de seguimiento
  pasoAlcanzado(paso: EstadoPedido): boolean {
    if (!this.pedido || this.pedido.estado === 'cancelado') return false;
    return PASOS.indexOf(paso) <= PASOS.indexOf(this.pedido.estado);
  }

  get vencido(): boolean {
    return !!this.pedido && this.pedido.estado === 'pendiente_pago' && new Date(this.pedido.expiraEn).getTime() <= Date.now();
  }

  private actualizarRestante(): void {
    if (this.pedido?.estado !== 'pendiente_pago') { this.restante = ''; return; }
    const ms = Math.max(0, new Date(this.pedido.expiraEn).getTime() - Date.now());
    const min = Math.floor(ms / 60000);
    const seg = Math.floor((ms % 60000) / 1000);
    this.restante = `${min}:${String(seg).padStart(2, '0')}`;
    this.cdr.detectChanges();
  }
}
