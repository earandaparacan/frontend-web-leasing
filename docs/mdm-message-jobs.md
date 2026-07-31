# Contrato de trabajos de mensajería MDM

La web utiliza este contrato para todos los envíos a dispositivos específicos, sin importar la cantidad seleccionada. Django publica los límites vigentes, persiste cada trabajo y lo procesa mediante una cola durable.

## Capacidades

`GET /api/v1/mdm/capabilities` devuelve el máximo de dispositivos, tamaño y concurrencia de consultas, longitud del mensaje y tamaño máximo de importación. La web no replica estos valores.

## Crear un trabajo

`POST /api/v1/mdm/message-jobs`

Headers:

```http
Idempotency-Key: <uuid generado por el cliente>
```

Body:

```json
{
  "devices": ["TKL-3019", "356938035643809"],
  "message": "Texto visible en el dispositivo"
}
```

Respuesta `202`:

```json
{
  "status": "success",
  "job": {
    "id": "0fe7adba-bb27-4b4b-8f65-bb71e70f164a",
    "status": "QUEUED",
    "total": 1000,
    "pending": 1000,
    "accepted": 0,
    "failed": 0
  }
}
```

La combinación de usuario autenticado e `Idempotency-Key` debe ser única. Una repetición devuelve el trabajo existente sin crear otro envío.

## Consultar progreso

`GET /api/v1/mdm/message-jobs/{job_id}` devuelve la misma estructura `job`.

Estados admitidos: `QUEUED`, `RUNNING`, `SUCCEEDED`, `PARTIAL_SUCCESS` y `FAILED`.

`accepted` significa aceptado por Headwind, no necesariamente entregado al dispositivo por MQTT.

## Reintentar fallidos

`POST /api/v1/mdm/message-jobs/{job_id}/retry-failures`

Debe volver a encolar únicamente elementos fallidos por errores transitorios y devolver el trabajo actualizado. Los dispositivos inexistentes y errores de permisos son fallos permanentes.

## Requisitos del worker

- Normalizar y deduplicar identificadores antes de crear los elementos.
- Procesar lotes configurables de hasta 100 dispositivos.
- Persistir el resultado de cada dispositivo antes de avanzar al siguiente lote.
- Reintentar errores de red, `429` y `5xx` con espera exponencial y un máximo configurable de intentos.
- Reanudar elementos `PENDING` después de un reinicio del worker.
- Limitar la concurrencia por empresa o cuenta MDM.
- Mantener auditoría del creador, fechas, mensaje, conteos y errores, sin registrar credenciales.

La garantía exactamente una vez solo es posible si Headwind acepta una clave idempotente por lote o dispositivo. Sin ese soporte, el backend debe documentar entrega al menos una vez y minimizar la ventana entre la aceptación remota y la confirmación local.
