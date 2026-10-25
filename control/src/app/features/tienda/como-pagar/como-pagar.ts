// ── IMPORTS ──────────────────────────────────
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toDataURL } from 'qrcode';

// ── DECORADOR ────────────────────────────────
// Cómo pagar con QR: un QR de muestra en el centro y los pasos para usarlo.
// El QR es de demostración: no lleva a ningún pago. Cada pedido real
// genera su propio QR en la pantalla del pedido.
@Component({
  selector: 'app-como-pagar',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './como-pagar.html',
  styleUrl: './como-pagar.css'
})
export class ComoPagarComponent implements OnInit {

  private cdr = inject(ChangeDetectorRef);

  qr = '';

  pasos = [
    { icono: 'add_shopping_cart', titulo: 'Armá tu carrito',       texto: 'Elegí productos del catálogo o de las promos y entrá al carrito.' },
    { icono: 'qr_code_2',         titulo: 'Tocá "Pagar con QR"',   texto: 'Completá tus datos y se genera el QR de tu pedido, con el total a pagar.' },
    { icono: 'photo_camera',      titulo: 'Escanealo',             texto: 'Abrí la app de tu billetera o banco en el celular y apuntá la cámara al QR.' },
    { icono: 'task_alt',          titulo: 'Confirmá el pago',      texto: 'Revisá el monto y confirmá. La pantalla del pedido se actualiza sola.' },
  ];

  ngOnInit(): void {
    toDataURL('PREMIUM MARKET - QR de demostracion. Cada pedido genera su propio QR.', {
      width: 520, margin: 1, errorCorrectionLevel: 'H', // 'H': se lee aunque el logo tape el centro
      color: { dark: '#2A1A35', light: '#FFFFFF' },
    }).then(qr => { this.qr = qr; this.cdr.detectChanges(); });
  }
}
