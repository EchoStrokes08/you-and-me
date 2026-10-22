export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      actividades: {
        Row: {
          activo: boolean;
          categorias: string[];
          creada_por: string | null;
          descripcion: string;
          dias_permitidos: number[] | null;
          emoji: string;
          es_comodin: boolean;
          es_sorpresa: boolean;
          franjas_permitidas: string[] | null;
          id: string;
          imagen_url: string | null;
          nombre: string;
          nota: string | null;
          orden: number;
          precio: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categorias?: string[];
          creada_por?: string | null;
          descripcion?: string;
          dias_permitidos?: number[] | null;
          emoji?: string;
          es_comodin?: boolean;
          es_sorpresa?: boolean;
          franjas_permitidas?: string[] | null;
          id?: string;
          imagen_url?: string | null;
          nombre: string;
          nota?: string | null;
          orden?: number;
          precio?: number;
        };
        Update: {
          activo?: boolean;
          categorias?: string[];
          creada_por?: string | null;
          descripcion?: string;
          dias_permitidos?: number[] | null;
          emoji?: string;
          es_comodin?: boolean;
          es_sorpresa?: boolean;
          franjas_permitidas?: string[] | null;
          id?: string;
          imagen_url?: string | null;
          nombre?: string;
          nota?: string | null;
          orden?: number;
          precio?: number;
        };
        Relationships: [
          {
            foreignKeyName: "actividades_creada_por_fkey";
            columns: ["creada_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      archivos_externos: {
        Row: {
          bucket: string;
          bytes: number | null;
          created_at: string;
          owner: string | null;
          ruta: string;
          tipo: string | null;
        };
        ComputedFields: never;
        Insert: {
          bucket: string;
          bytes?: number | null;
          created_at?: string;
          owner?: string | null;
          ruta: string;
          tipo?: string | null;
        };
        Update: {
          bucket?: string;
          bytes?: number | null;
          created_at?: string;
          owner?: string | null;
          ruta?: string;
          tipo?: string | null;
        };
        Relationships: [];
      };
      asistente_conversaciones: {
        Row: {
          created_at: string;
          id: string;
          titulo: string;
          updated_at: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          titulo: string;
          updated_at?: string;
          usuario_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          titulo?: string;
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      asistente_mensajes: {
        Row: {
          acciones: NonNullable<Json>;
          contenido: string;
          conversacion_id: string;
          created_at: string;
          id: string;
          rol: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          acciones?: NonNullable<Json>;
          contenido: string;
          conversacion_id: string;
          created_at?: string;
          id?: string;
          rol: string;
          usuario_id?: string;
        };
        Update: {
          acciones?: NonNullable<Json>;
          contenido?: string;
          conversacion_id?: string;
          created_at?: string;
          id?: string;
          rol?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asistente_mensajes_conversacion_id_fkey";
            columns: ["conversacion_id"];
            isOneToOne: false;
            referencedRelation: "asistente_conversaciones";
            referencedColumns: ["id"];
          },
        ];
      };
      canciones: {
        Row: {
          agregada_por: string;
          artista: string;
          created_at: string;
          id: string;
          nota: string;
          recuerdo_id: string | null;
          titulo: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          agregada_por?: string;
          artista?: string;
          created_at?: string;
          id?: string;
          nota?: string;
          recuerdo_id?: string | null;
          titulo: string;
          url?: string | null;
        };
        Update: {
          agregada_por?: string;
          artista?: string;
          created_at?: string;
          id?: string;
          nota?: string;
          recuerdo_id?: string | null;
          titulo?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "canciones_recuerdo_id_fkey";
            columns: ["recuerdo_id"];
            isOneToOne: false;
            referencedRelation: "recuerdos";
            referencedColumns: ["id"];
          },
        ];
      };
      capsula_items: {
        Row: {
          capsula_id: string;
          created_at: string;
          de: string;
          id: string;
          ruta: string | null;
          texto: string | null;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          capsula_id: string;
          created_at?: string;
          de?: string;
          id?: string;
          ruta?: string | null;
          texto?: string | null;
          tipo: string;
        };
        Update: {
          capsula_id?: string;
          created_at?: string;
          de?: string;
          id?: string;
          ruta?: string | null;
          texto?: string | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capsula_items_capsula_id_fkey";
            columns: ["capsula_id"];
            isOneToOne: false;
            referencedRelation: "capsulas";
            referencedColumns: ["id"];
          },
        ];
      };
      capsulas: {
        Row: {
          abrir_en: string;
          aviso_enviado: boolean;
          creada_por: string;
          created_at: string;
          emoji: string;
          id: string;
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          abrir_en: string;
          aviso_enviado?: boolean;
          creada_por?: string;
          created_at?: string;
          emoji?: string;
          id?: string;
          titulo: string;
        };
        Update: {
          abrir_en?: string;
          aviso_enviado?: boolean;
          creada_por?: string;
          created_at?: string;
          emoji?: string;
          id?: string;
          titulo?: string;
        };
        Relationships: [];
      };
      cartas: {
        Row: {
          abierta_en: string | null;
          abrir_desde: string | null;
          audio: string | null;
          aviso_enviado: boolean;
          contenido: string;
          created_at: string;
          de: string;
          emoji: string;
          id: string;
          momento: string | null;
          para: string;
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          abierta_en?: string | null;
          abrir_desde?: string | null;
          audio?: string | null;
          aviso_enviado?: boolean;
          contenido: string;
          created_at?: string;
          de?: string;
          emoji?: string;
          id?: string;
          momento?: string | null;
          para: string;
          titulo: string;
        };
        Update: {
          abierta_en?: string | null;
          abrir_desde?: string | null;
          audio?: string | null;
          aviso_enviado?: boolean;
          contenido?: string;
          created_at?: string;
          de?: string;
          emoji?: string;
          id?: string;
          momento?: string | null;
          para?: string;
          titulo?: string;
        };
        Relationships: [];
      };
      categorias_cita: {
        Row: {
          activo: boolean;
          color: string;
          descripcion: string;
          emoji: string;
          nombre: string;
          orden: number;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          color?: string;
          descripcion?: string;
          emoji?: string;
          nombre: string;
          orden?: number;
          slug: string;
        };
        Update: {
          activo?: boolean;
          color?: string;
          descripcion?: string;
          emoji?: string;
          nombre?: string;
          orden?: number;
          slug?: string;
        };
        Relationships: [];
      };
      categorias_preguntas: {
        Row: {
          activo: boolean;
          color: string;
          emoji: string;
          nombre: string;
          orden: number;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          color?: string;
          emoji?: string;
          nombre: string;
          orden?: number;
          slug: string;
        };
        Update: {
          activo?: boolean;
          color?: string;
          emoji?: string;
          nombre?: string;
          orden?: number;
          slug?: string;
        };
        Relationships: [];
      };
      ciclo_avisos: {
        Row: {
          created_at: string;
          de: string;
          enviado_en: string | null;
          enviar_en: string;
          id: string;
          para: string;
          sobre: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          de?: string;
          enviado_en?: string | null;
          enviar_en?: string;
          id?: string;
          para: string;
          sobre: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          de?: string;
          enviado_en?: string | null;
          enviar_en?: string;
          id?: string;
          para?: string;
          sobre?: NonNullable<Json>;
        };
        Relationships: [];
      };
      ciclo_compartido: {
        Row: {
          destino: string;
          duena: string;
          sobre: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          destino: string;
          duena?: string;
          sobre: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          destino?: string;
          duena?: string;
          sobre?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [];
      };
      ciclo_consentimientos: {
        Row: {
          accion: string;
          created_at: string;
          id: string;
          usuario_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          accion: string;
          created_at?: string;
          id?: string;
          usuario_id?: string;
          version: string;
        };
        Update: {
          accion?: string;
          created_at?: string;
          id?: string;
          usuario_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      ciclo_datos: {
        Row: {
          id: string;
          sobre: NonNullable<Json>;
          updated_at: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          sobre: NonNullable<Json>;
          updated_at?: string;
          usuario_id?: string;
        };
        Update: {
          id?: string;
          sobre?: NonNullable<Json>;
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      ciclo_llaves: {
        Row: {
          llavero: Json | null;
          llavero_recuperacion: Json | null;
          publica: NonNullable<Json>;
          updated_at: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          llavero?: Json | null;
          llavero_recuperacion?: Json | null;
          publica: NonNullable<Json>;
          updated_at?: string;
          usuario_id?: string;
        };
        Update: {
          llavero?: Json | null;
          llavero_recuperacion?: Json | null;
          publica?: NonNullable<Json>;
          updated_at?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      cita_detalles: {
        Row: {
          cita_id: string;
          opcion_id: string;
        };
        ComputedFields: never;
        Insert: {
          cita_id: string;
          opcion_id: string;
        };
        Update: {
          cita_id?: string;
          opcion_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cita_detalles_cita_id_fkey";
            columns: ["cita_id"];
            isOneToOne: false;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cita_detalles_opcion_id_fkey";
            columns: ["opcion_id"];
            isOneToOne: false;
            referencedRelation: "opciones_llevar";
            referencedColumns: ["id"];
          },
        ];
      };
      citas: {
        Row: {
          actividad_id: string | null;
          categoria_slug: string | null;
          creada_por: string;
          created_at: string;
          es_cita_sorpresa: boolean;
          estado: string;
          fecha: string | null;
          franja_id: string | null;
          hora_confirmada: string | null;
          id: string;
          lugar_direccion: string | null;
          lugar_id: string | null;
          lugar_lat: number | null;
          lugar_lng: number | null;
          lugar_personalizado: string | null;
          modificada: boolean;
          nota_admin: string | null;
          nota_ella: string | null;
          recordatorio_hoy: boolean;
          recordatorio_noche: boolean;
          updated_at: string;
          vestimenta_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actividad_id?: string | null;
          categoria_slug?: string | null;
          creada_por: string;
          created_at?: string;
          es_cita_sorpresa?: boolean;
          estado?: string;
          fecha?: string | null;
          franja_id?: string | null;
          hora_confirmada?: string | null;
          id?: string;
          lugar_direccion?: string | null;
          lugar_id?: string | null;
          lugar_lat?: number | null;
          lugar_lng?: number | null;
          lugar_personalizado?: string | null;
          modificada?: boolean;
          nota_admin?: string | null;
          nota_ella?: string | null;
          recordatorio_hoy?: boolean;
          recordatorio_noche?: boolean;
          updated_at?: string;
          vestimenta_id?: string | null;
        };
        Update: {
          actividad_id?: string | null;
          categoria_slug?: string | null;
          creada_por?: string;
          created_at?: string;
          es_cita_sorpresa?: boolean;
          estado?: string;
          fecha?: string | null;
          franja_id?: string | null;
          hora_confirmada?: string | null;
          id?: string;
          lugar_direccion?: string | null;
          lugar_id?: string | null;
          lugar_lat?: number | null;
          lugar_lng?: number | null;
          lugar_personalizado?: string | null;
          modificada?: boolean;
          nota_admin?: string | null;
          nota_ella?: string | null;
          recordatorio_hoy?: boolean;
          recordatorio_noche?: boolean;
          updated_at?: string;
          vestimenta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "citas_actividad_id_fkey";
            columns: ["actividad_id"];
            isOneToOne: false;
            referencedRelation: "actividades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_categoria_slug_fkey";
            columns: ["categoria_slug"];
            isOneToOne: false;
            referencedRelation: "categorias_cita";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "citas_franja_id_fkey";
            columns: ["franja_id"];
            isOneToOne: false;
            referencedRelation: "franjas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_lugar_id_fkey";
            columns: ["lugar_id"];
            isOneToOne: false;
            referencedRelation: "lugares";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "citas_vestimenta_id_fkey";
            columns: ["vestimenta_id"];
            isOneToOne: false;
            referencedRelation: "opciones_llevar";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracion: {
        Row: {
          apodo_ella: string;
          archivos_en: string;
          color_principal: string;
          componente_primario: string;
          componente_secundario: string;
          copia_avisada_en: string | null;
          cumple_el: string | null;
          cumple_ella: string | null;
          fecha_inicio: string;
          id: number;
          nombre_app: string;
          nombre_el: string;
          nombre_ella: string;
          ultima_copia: string | null;
          whatsapp: string;
          whatsapp_ella: string;
        };
        ComputedFields: never;
        Insert: {
          apodo_ella?: string;
          archivos_en?: string;
          color_principal?: string;
          componente_primario?: string;
          componente_secundario?: string;
          copia_avisada_en?: string | null;
          cumple_el?: string | null;
          cumple_ella?: string | null;
          fecha_inicio?: string;
          id?: number;
          nombre_app?: string;
          nombre_el?: string;
          nombre_ella?: string;
          ultima_copia?: string | null;
          whatsapp?: string;
          whatsapp_ella?: string;
        };
        Update: {
          apodo_ella?: string;
          archivos_en?: string;
          color_principal?: string;
          componente_primario?: string;
          componente_secundario?: string;
          copia_avisada_en?: string | null;
          cumple_el?: string | null;
          cumple_ella?: string | null;
          fecha_inicio?: string;
          id?: number;
          nombre_app?: string;
          nombre_el?: string;
          nombre_ella?: string;
          ultima_copia?: string | null;
          whatsapp?: string;
          whatsapp_ella?: string;
        };
        Relationships: [];
      };
      dias_importantes: {
        Row: {
          avisado: boolean;
          created_at: string;
          fecha: string;
          id: string;
          titulo: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          avisado?: boolean;
          created_at?: string;
          fecha: string;
          id?: string;
          titulo: string;
          usuario_id?: string;
        };
        Update: {
          avisado?: boolean;
          created_at?: string;
          fecha?: string;
          id?: string;
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      estados_animo: {
        Row: {
          created_at: string;
          emoji: string;
          etiqueta: string;
          fecha: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          emoji: string;
          etiqueta: string;
          fecha?: string;
          usuario_id?: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          etiqueta?: string;
          fecha?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      fechas_no_disponibles: {
        Row: {
          creado_por: string;
          fecha: string;
          motivo: string | null;
        };
        ComputedFields: never;
        Insert: {
          creado_por?: string;
          fecha: string;
          motivo?: string | null;
        };
        Update: {
          creado_por?: string;
          fecha?: string;
          motivo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fechas_no_disponibles_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fotos_recuerdo: {
        Row: {
          favorita: boolean;
          id: string;
          orden: number;
          recuerdo_id: string;
          ruta: string;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          favorita?: boolean;
          id?: string;
          orden?: number;
          recuerdo_id: string;
          ruta: string;
          tipo?: string;
        };
        Update: {
          favorita?: boolean;
          id?: string;
          orden?: number;
          recuerdo_id?: string;
          ruta?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fotos_recuerdo_recuerdo_id_fkey";
            columns: ["recuerdo_id"];
            isOneToOne: false;
            referencedRelation: "recuerdos";
            referencedColumns: ["id"];
          },
        ];
      };
      franjas: {
        Row: {
          activo: boolean;
          emoji: string;
          horario: string;
          id: string;
          nombre: string;
          orden: number;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          emoji?: string;
          horario?: string;
          id?: string;
          nombre: string;
          orden?: number;
        };
        Update: {
          activo?: boolean;
          emoji?: string;
          horario?: string;
          id?: string;
          nombre?: string;
          orden?: number;
        };
        Relationships: [];
      };
      gratitudes: {
        Row: {
          created_at: string;
          fecha: string;
          id: string;
          texto: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          fecha?: string;
          id?: string;
          texto: string;
          usuario_id?: string;
        };
        Update: {
          created_at?: string;
          fecha?: string;
          id?: string;
          texto?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      lugar_actividad: {
        Row: {
          actividad_id: string;
          lugar_id: string;
        };
        ComputedFields: never;
        Insert: {
          actividad_id: string;
          lugar_id: string;
        };
        Update: {
          actividad_id?: string;
          lugar_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lugar_actividad_actividad_id_fkey";
            columns: ["actividad_id"];
            isOneToOne: false;
            referencedRelation: "actividades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lugar_actividad_lugar_id_fkey";
            columns: ["lugar_id"];
            isOneToOne: false;
            referencedRelation: "lugares";
            referencedColumns: ["id"];
          },
        ];
      };
      lugares: {
        Row: {
          activo: boolean;
          categorias: string[];
          descripcion: string;
          duracion: string;
          emoji: string;
          es_escapada: boolean;
          es_sorpresa: boolean;
          id: string;
          imagen_url: string | null;
          lat: number | null;
          link_maps: string | null;
          lng: number | null;
          nombre: string;
          orden: number;
          precio: number;
          zona: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categorias?: string[];
          descripcion?: string;
          duracion?: string;
          emoji?: string;
          es_escapada?: boolean;
          es_sorpresa?: boolean;
          id?: string;
          imagen_url?: string | null;
          lat?: number | null;
          link_maps?: string | null;
          lng?: number | null;
          nombre: string;
          orden?: number;
          precio?: number;
          zona?: string;
        };
        Update: {
          activo?: boolean;
          categorias?: string[];
          descripcion?: string;
          duracion?: string;
          emoji?: string;
          es_escapada?: boolean;
          es_sorpresa?: boolean;
          id?: string;
          imagen_url?: string | null;
          lat?: number | null;
          link_maps?: string | null;
          lng?: number | null;
          nombre?: string;
          orden?: number;
          precio?: number;
          zona?: string;
        };
        Relationships: [];
      };
      lugares_por_conocer: {
        Row: {
          categoria_slug: string | null;
          creado_por: string;
          created_at: string;
          direccion: string;
          id: string;
          lat: number;
          lng: number;
          nombre: string;
          nota: string;
        };
        ComputedFields: never;
        Insert: {
          categoria_slug?: string | null;
          creado_por?: string;
          created_at?: string;
          direccion?: string;
          id?: string;
          lat: number;
          lng: number;
          nombre: string;
          nota?: string;
        };
        Update: {
          categoria_slug?: string | null;
          creado_por?: string;
          created_at?: string;
          direccion?: string;
          id?: string;
          lat?: number;
          lng?: number;
          nombre?: string;
          nota?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lugares_por_conocer_categoria_slug_fkey";
            columns: ["categoria_slug"];
            isOneToOne: false;
            referencedRelation: "categorias_cita";
            referencedColumns: ["slug"];
          },
        ];
      };
      notas_recuerdo: {
        Row: {
          created_at: string;
          id: string;
          recuerdo_id: string;
          texto: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          recuerdo_id: string;
          texto: string;
          usuario_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          recuerdo_id?: string;
          texto?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notas_recuerdo_recuerdo_id_fkey";
            columns: ["recuerdo_id"];
            isOneToOne: false;
            referencedRelation: "recuerdos";
            referencedColumns: ["id"];
          },
        ];
      };
      opciones_llevar: {
        Row: {
          activo: boolean;
          descripcion: string;
          emoji: string;
          es_sorpresa: boolean;
          id: string;
          imagen_url: string | null;
          nombre: string;
          orden: number;
          tipo: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          descripcion?: string;
          emoji?: string;
          es_sorpresa?: boolean;
          id?: string;
          imagen_url?: string | null;
          nombre: string;
          orden?: number;
          tipo: string;
        };
        Update: {
          activo?: boolean;
          descripcion?: string;
          emoji?: string;
          es_sorpresa?: boolean;
          id?: string;
          imagen_url?: string | null;
          nombre?: string;
          orden?: number;
          tipo?: string;
        };
        Relationships: [];
      };
      pelis: {
        Row: {
          agregada_por: string;
          created_at: string;
          donde: string;
          id: string;
          tipo: string;
          titulo: string;
          vista_en: string | null;
        };
        ComputedFields: never;
        Insert: {
          agregada_por?: string;
          created_at?: string;
          donde?: string;
          id?: string;
          tipo?: string;
          titulo: string;
          vista_en?: string | null;
        };
        Update: {
          agregada_por?: string;
          created_at?: string;
          donde?: string;
          id?: string;
          tipo?: string;
          titulo?: string;
          vista_en?: string | null;
        };
        Relationships: [];
      };
      pelis_calificacion: {
        Row: {
          estrellas: number;
          peli_id: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          estrellas: number;
          peli_id: string;
          usuario_id?: string;
        };
        Update: {
          estrellas?: number;
          peli_id?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pelis_calificacion_peli_id_fkey";
            columns: ["peli_id"];
            isOneToOne: false;
            referencedRelation: "pelis";
            referencedColumns: ["id"];
          },
        ];
      };
      pensamientos: {
        Row: {
          audio: string | null;
          created_at: string;
          de: string;
          duracion: number | null;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          audio?: string | null;
          created_at?: string;
          de?: string;
          duracion?: number | null;
          id?: string;
        };
        Update: {
          audio?: string | null;
          created_at?: string;
          de?: string;
          duracion?: number | null;
          id?: string;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          avisos_silenciados: string[];
          id: string;
          nombre: string;
          rol: string;
        };
        ComputedFields: never;
        Insert: {
          avisos_silenciados?: string[];
          id: string;
          nombre?: string;
          rol?: string;
        };
        Update: {
          avisos_silenciados?: string[];
          id?: string;
          nombre?: string;
          rol?: string;
        };
        Relationships: [];
      };
      permisos: {
        Row: {
          es_admin: boolean;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          es_admin?: boolean;
          usuario_id: string;
        };
        Update: {
          es_admin?: boolean;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permisos_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: true;
            referencedRelation: "perfiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pregunta_del_dia: {
        Row: {
          fecha: string;
          pregunta_id: string;
        };
        ComputedFields: never;
        Insert: {
          fecha: string;
          pregunta_id: string;
        };
        Update: {
          fecha?: string;
          pregunta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pregunta_del_dia_pregunta_id_fkey";
            columns: ["pregunta_id"];
            isOneToOne: false;
            referencedRelation: "preguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      preguntas: {
        Row: {
          activo: boolean;
          categoria_slug: string;
          id: string;
          orden: number;
          propuesta_por: string | null;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          categoria_slug: string;
          id?: string;
          orden?: number;
          propuesta_por?: string | null;
          texto: string;
        };
        Update: {
          activo?: boolean;
          categoria_slug?: string;
          id?: string;
          orden?: number;
          propuesta_por?: string | null;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "preguntas_categoria_slug_fkey";
            columns: ["categoria_slug"];
            isOneToOne: false;
            referencedRelation: "categorias_preguntas";
            referencedColumns: ["slug"];
          },
        ];
      };
      preguntas_conversadas: {
        Row: {
          fecha: string;
          pregunta_id: string;
        };
        ComputedFields: never;
        Insert: {
          fecha?: string;
          pregunta_id: string;
        };
        Update: {
          fecha?: string;
          pregunta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "preguntas_conversadas_pregunta_id_fkey";
            columns: ["pregunta_id"];
            isOneToOne: true;
            referencedRelation: "preguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      preguntas_propias: {
        Row: {
          created_at: string;
          de: string;
          id: string;
          pregunta_id: string | null;
          texto: string;
          usada_en: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          de?: string;
          id?: string;
          pregunta_id?: string | null;
          texto: string;
          usada_en?: string | null;
        };
        Update: {
          created_at?: string;
          de?: string;
          id?: string;
          pregunta_id?: string | null;
          texto?: string;
          usada_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "preguntas_propias_pregunta_id_fkey";
            columns: ["pregunta_id"];
            isOneToOne: false;
            referencedRelation: "preguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      reacciones_respuesta: {
        Row: {
          corazon: boolean;
          created_at: string;
          de: string;
          respuesta_id: string;
          texto: string | null;
        };
        ComputedFields: never;
        Insert: {
          corazon?: boolean;
          created_at?: string;
          de?: string;
          respuesta_id: string;
          texto?: string | null;
        };
        Update: {
          corazon?: boolean;
          created_at?: string;
          de?: string;
          respuesta_id?: string;
          texto?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reacciones_respuesta_respuesta_id_fkey";
            columns: ["respuesta_id"];
            isOneToOne: false;
            referencedRelation: "respuestas";
            referencedColumns: ["id"];
          },
        ];
      };
      recuerdos: {
        Row: {
          calificacion: number;
          cita_id: string | null;
          creado_por: string;
          created_at: string;
          descripcion: string;
          fecha: string;
          id: string;
          lat: number | null;
          lng: number | null;
          lugar_texto: string;
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          calificacion?: number;
          cita_id?: string | null;
          creado_por: string;
          created_at?: string;
          descripcion?: string;
          fecha: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          lugar_texto?: string;
          titulo: string;
        };
        Update: {
          calificacion?: number;
          cita_id?: string | null;
          creado_por?: string;
          created_at?: string;
          descripcion?: string;
          fecha?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          lugar_texto?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recuerdos_cita_id_fkey";
            columns: ["cita_id"];
            isOneToOne: false;
            referencedRelation: "citas";
            referencedColumns: ["id"];
          },
        ];
      };
      regalos: {
        Row: {
          created_at: string;
          de: string;
          id: string;
          link: string | null;
          me_encanta: boolean;
          nombre: string;
          nota: string;
          ocasion: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          de?: string;
          id?: string;
          link?: string | null;
          me_encanta?: boolean;
          nombre: string;
          nota?: string;
          ocasion?: string | null;
        };
        Update: {
          created_at?: string;
          de?: string;
          id?: string;
          link?: string | null;
          me_encanta?: boolean;
          nombre?: string;
          nota?: string;
          ocasion?: string | null;
        };
        Relationships: [];
      };
      regalos_comprados: {
        Row: {
          comprado_por: string;
          created_at: string;
          regalo_id: string;
        };
        ComputedFields: never;
        Insert: {
          comprado_por?: string;
          created_at?: string;
          regalo_id: string;
        };
        Update: {
          comprado_por?: string;
          created_at?: string;
          regalo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regalos_comprados_regalo_id_fkey";
            columns: ["regalo_id"];
            isOneToOne: true;
            referencedRelation: "regalos";
            referencedColumns: ["id"];
          },
        ];
      };
      respuestas: {
        Row: {
          created_at: string;
          id: string;
          pregunta_id: string;
          texto: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          pregunta_id: string;
          texto: string;
          usuario_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pregunta_id?: string;
          texto?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "respuestas_pregunta_id_fkey";
            columns: ["pregunta_id"];
            isOneToOne: false;
            referencedRelation: "preguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      retos: {
        Row: {
          activo: boolean;
          emoji: string;
          id: string;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          emoji?: string;
          id?: string;
          texto: string;
        };
        Update: {
          activo?: boolean;
          emoji?: string;
          id?: string;
          texto?: string;
        };
        Relationships: [];
      };
      retos_mes: {
        Row: {
          cumplido_en: string | null;
          mes: string;
          recuerdo_id: string | null;
          reto_id: string;
        };
        ComputedFields: never;
        Insert: {
          cumplido_en?: string | null;
          mes: string;
          recuerdo_id?: string | null;
          reto_id: string;
        };
        Update: {
          cumplido_en?: string | null;
          mes?: string;
          recuerdo_id?: string | null;
          reto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retos_mes_recuerdo_id_fkey";
            columns: ["recuerdo_id"];
            isOneToOne: false;
            referencedRelation: "recuerdos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retos_mes_reto_id_fkey";
            columns: ["reto_id"];
            isOneToOne: false;
            referencedRelation: "retos";
            referencedColumns: ["id"];
          },
        ];
      };
      suenos: {
        Row: {
          creado_por: string;
          created_at: string;
          cumplido_en: string | null;
          emoji: string;
          id: string;
          nota: string;
          recuerdo_id: string | null;
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          creado_por?: string;
          created_at?: string;
          cumplido_en?: string | null;
          emoji?: string;
          id?: string;
          nota?: string;
          recuerdo_id?: string | null;
          titulo: string;
        };
        Update: {
          creado_por?: string;
          created_at?: string;
          cumplido_en?: string | null;
          emoji?: string;
          id?: string;
          nota?: string;
          recuerdo_id?: string | null;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suenos_recuerdo_id_fkey";
            columns: ["recuerdo_id"];
            isOneToOne: false;
            referencedRelation: "recuerdos";
            referencedColumns: ["id"];
          },
        ];
      };
      suscripciones_push: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          p256dh: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          p256dh: string;
          usuario_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          p256dh?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      vales: {
        Row: {
          created_at: string;
          cumplido_en: string | null;
          de: string;
          detalle: string;
          emoji: string;
          id: string;
          para: string;
          redimido_en: string | null;
          titulo: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          cumplido_en?: string | null;
          de?: string;
          detalle?: string;
          emoji?: string;
          id?: string;
          para: string;
          redimido_en?: string | null;
          titulo: string;
        };
        Update: {
          created_at?: string;
          cumplido_en?: string | null;
          de?: string;
          detalle?: string;
          emoji?: string;
          id?: string;
          para?: string;
          redimido_en?: string | null;
          titulo?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abrir_carta: { Args: { p_id: string }; Returns: string };
      archivos_por_liberar: {
        Args: { p_limite?: number };
        Returns: {
          bucket: string;
          ruta: string;
        }[];
      };
      archivos_por_mover: {
        Args: { p_limite?: number };
        Returns: {
          bucket: string;
          bytes: number;
          owner: string;
          ruta: string;
          tipo: string;
        }[];
      };
      avisar_capsulas_abiertas: { Args: Record<PropertyKey, never>; Returns: undefined };
      avisar_cartas_disponibles: { Args: Record<PropertyKey, never>; Returns: undefined };
      avisar_copia_pendiente: { Args: Record<PropertyKey, never>; Returns: undefined };
      avisar_dias_importantes: { Args: Record<PropertyKey, never>; Returns: undefined };
      avisar_fechas_especiales: { Args: Record<PropertyKey, never>; Returns: undefined };
      avisar_un_dia_como_hoy: { Args: Record<PropertyKey, never>; Returns: undefined };
      borrar_suscripciones_vencidas: {
        Args: { p_endpoints: string[]; p_secreto: string };
        Returns: undefined;
      };
      cambiar_reto_del_mes: { Args: Record<PropertyKey, never>; Returns: undefined };
      capsula_abierta: { Args: { p_id: string }; Returns: boolean };
      capsula_sellada: { Args: { p_id: string }; Returns: boolean };
      capsula_tiene_ajenos: { Args: { p_id: string }; Returns: boolean };
      capsulas_conteo: {
        Args: Record<PropertyKey, never>;
        Returns: {
          cantidad: number;
          capsula_id: string;
          de: string;
        }[];
      };
      cartas_recibidas: {
        Args: Record<PropertyKey, never>;
        Returns: {
          abierta_en: string;
          abrir_desde: string;
          audio: string;
          contenido: string;
          created_at: string;
          de: string;
          disponible: boolean;
          emoji: string;
          id: string;
          momento: string;
          titulo: string;
        }[];
      };
      ciclo_id_pareja: { Args: Record<PropertyKey, never>; Returns: string };
      ciclo_llave_pareja: {
        Args: Record<PropertyKey, never>;
        Returns: {
          publica: Json;
          usuario_id: string;
        }[];
      };
      contar_logros: { Args: Record<PropertyKey, never>; Returns: Json };
      cumplir_vale: { Args: { p_id: string }; Returns: undefined };
      enviar_avisos_ciclo: { Args: Record<PropertyKey, never>; Returns: undefined };
      enviar_push: {
        Args: { p_datos: Json; p_destino: string; p_evento: string; p_nombre: string };
        Returns: undefined;
      };
      es_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      estado_migracion: { Args: Record<PropertyKey, never>; Returns: Json };
      estado_notificaciones: {
        Args: Record<PropertyKey, never>;
        Returns: {
          celulares: number;
          nombre: string;
          silenciados: string[];
          ultima: string;
          usuario_id: string;
        }[];
      };
      estado_respuestas: {
        Args: { p_pregunta_id: string };
        Returns: {
          pareja: boolean;
          yo: boolean;
        }[];
      };
      fijar_pregunta_del_dia: { Args: { p_fecha: string; p_pregunta: string }; Returns: undefined };
      grupo_aviso: { Args: { p_evento: string }; Returns: string };
      guardar_mascotas: {
        Args: { p_primario?: string; p_secundario?: string };
        Returns: undefined;
      };
      hoy_bogota: { Args: Record<PropertyKey, never>; Returns: string };
      marcar_favorita: { Args: { p_favorita: boolean; p_id: string }; Returns: undefined };
      obtener_pregunta_del_dia: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activo: boolean;
          categoria_slug: string;
          id: string;
          orden: number;
          propuesta_por: string | null;
          texto: string;
        };
        SetofOptions: {
          from: "*";
          to: "preguntas";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      obtener_respuestas: {
        Args: { p_pregunta_id: string };
        Returns: {
          created_at: string;
          id: string;
          pregunta_id: string;
          texto: string;
          usuario_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "respuestas";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      preguntas_al_asistente_hoy: { Args: Record<PropertyKey, never>; Returns: number };
      probar_notificacion: { Args: { p_destino: string }; Returns: undefined };
      puede_ver_adjunto: { Args: { p_ruta: string }; Returns: boolean };
      racha_preguntas: {
        Args: Record<PropertyKey, never>;
        Returns: {
          dias: number;
          hoy_completo: boolean;
        }[];
      };
      recordar_citas: { Args: Record<PropertyKey, never>; Returns: undefined };
      recordar_racha: { Args: Record<PropertyKey, never>; Returns: undefined };
      recuerdo_de_hoy: {
        Args: Record<PropertyKey, never>;
        Returns: {
          fecha: string;
          hace: string;
          id: string;
          titulo: string;
        }[];
      };
      redimir_vale: { Args: { p_id: string }; Returns: undefined };
      reto_del_mes: {
        Args: Record<PropertyKey, never>;
        Returns: {
          cumplido_en: string;
          emoji: string;
          mes: string;
          recuerdo_id: string;
          reto_id: string;
          texto: string;
        }[];
      };
      uso_espacio: { Args: Record<PropertyKey, never>; Returns: Json };
      ya_respondi: { Args: { p_pregunta_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
