import type { Metadata } from "next";
import Link from "next/link";
import styles from "./politica-de-privacidad.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad | Teklease",
  description:
    "Política de privacidad de la aplicación móvil Teklease para clientes.",
};

const lastUpdated = "2 de septiembre de 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.content}>
        <header className={styles.header}>
          <Link className={styles.wordmark} href="/" aria-label="Teklease, inicio">
            teklease<span>.</span>
          </Link>
          <p className={styles.eyebrow}>Aplicación móvil para clientes</p>
          <h1>Política de privacidad</h1>
          <p className={styles.introduction}>
            En Teklease protegemos la información personal de nuestros clientes. Esta política
            explica cómo tratamos los datos al utilizar la aplicación móvil Teklease.
          </p>
          <p className={styles.updated}>Última actualización: {lastUpdated}</p>
        </header>

        <section>
          <h2>1. Responsable del tratamiento</h2>
          <p>
            Teklease es responsable del tratamiento de los datos personales recopilados mediante
            la aplicación móvil Teklease, destinada a clientes con contratos de leasing.
          </p>
        </section>

        <section>
          <h2>2. Datos que tratamos</h2>
          <p>Según las funcionalidades que utilices, podemos tratar las siguientes categorías:</p>
          <ul>
            <li>
              <strong>Datos de identificación y contacto:</strong> número de cédula, número de
              teléfono y el código de verificación de un solo uso (OTP) necesario para iniciar
              sesión.
            </li>
            <li>
              <strong>Datos contractuales y de facturación:</strong> información del contrato,
              cuotas, facturas, importes, vencimientos, recibos y estado de pagos.
            </li>
            <li>
              <strong>Comprobantes:</strong> imágenes y datos del comprobante que decidas
              adjuntar para informar un pago.
            </li>
            <li>
              <strong>Datos del dispositivo:</strong> token de notificaciones, identificadores
              técnicos y la información necesaria para mantener una sesión segura.
            </li>
            <li>
              <strong>Permisos del dispositivo:</strong> ubicación, estado del teléfono e
              información de uso de aplicaciones, únicamente cuando otorgues esos permisos y para
              las funciones de gestión y seguridad asociadas al equipo incluido en tu contrato.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Finalidades</h2>
          <p>Usamos los datos para:</p>
          <ul>
            <li>verificar tu identidad y proteger el acceso a tu cuenta;</li>
            <li>mostrar el estado de tu contrato, facturas, recibos y pagos;</li>
            <li>procesar solicitudes de pago y actualizar el estado de las facturas;</li>
            <li>recibir y revisar comprobantes de pago que envíes;</li>
            <li>enviar notificaciones sobre pagos, reparaciones y comunicaciones de Teklease;</li>
            <li>brindar soporte, prevenir fraude y mantener la seguridad del servicio; y</li>
            <li>cumplir obligaciones legales, contractuales y contables aplicables.</li>
          </ul>
        </section>

        <section>
          <h2>4. Pagos con Pagopar</h2>
          <p>
            Cuando elegís pagar una factura con Pagopar, la aplicación abre el entorno de pago
            externo de Pagopar. Pagopar procesa la transacción conforme a sus propias políticas.
            Teklease recibe y conserva solamente la información necesaria para identificar la
            operación y reflejar su estado en tu factura; no almacenamos datos de tarjetas ni
            credenciales de pago ingresados en el checkout de Pagopar.
          </p>
        </section>

        <section>
          <h2>5. Con quién compartimos los datos</h2>
          <p>
            Podemos compartir datos personales con nuestros proveedores tecnológicos y con
            Pagopar cuando sea necesario para prestar el servicio, procesar pagos, enviar
            notificaciones o cumplir obligaciones legales. Exigimos que estos terceros traten la
            información únicamente para las finalidades correspondientes y con medidas de
            seguridad adecuadas.
          </p>
        </section>

        <section>
          <h2>6. Conservación y seguridad</h2>
          <p>
            Conservamos los datos durante el tiempo necesario para la relación contractual, las
            finalidades descritas en esta política y los plazos legales aplicables. Aplicamos
            medidas técnicas y organizativas razonables para proteger la información contra
            accesos no autorizados, pérdida, alteración o divulgación indebida.
          </p>
        </section>

        <section>
          <h2>7. Tus opciones y derechos</h2>
          <p>
            Podés rechazar o revocar los permisos opcionales desde la configuración de tu
            dispositivo; algunas funciones podrían dejar de estar disponibles. También podés
            solicitar información sobre tus datos, su actualización, corrección o eliminación,
            sujeto a las obligaciones legales y contractuales que correspondan.
          </p>
        </section>

        <section>
          <h2>8. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta política cuando cambien la aplicación, nuestros procesos o
            las obligaciones aplicables. Publicaremos la versión vigente en esta misma URL e
            indicaremos la fecha de su última actualización.
          </p>
        </section>

        <section className={styles.contact}>
          <h2>9. Contacto</h2>
          <p>
            Para consultas sobre esta política o el tratamiento de tus datos, escribinos a{" "}
            <a href="mailto:soporte@teklease.com.py">soporte@teklease.com.py</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
