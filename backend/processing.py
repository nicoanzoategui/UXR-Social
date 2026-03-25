import pandas as pd
from datetime import datetime
import os
import json
import re
import unicodedata
from typing import List, Dict
from models import Comment, Dataset
from sqlmodel import Session

# Sprout Social CSV Columns Mapping
# These include English and Spanish (observed) variations
COLUMN_MAPPING = {
    "Network": "network",
    "Red": "network",
    "Inbox": "network",
    "Profile Name": "account_name",
    "Perfil conectado": "account_name",
    "Profile": "account_name",
    "Post ID": "post_id",
    "ID de publicación principal": "post_id",
    "Post Text": "post_text",
    "Link": "post_url",
    "Enlace permanente": "post_url",
    "Interaction ID": "comment_id",
    "ID de mensaje": "comment_id",
    "GUID (Identificación interna)": "comment_id",
    "Interaction Text": "comment_text",
    "Message": "comment_text",
    "Text": "comment_text",
    "Username": "author_name",
    "Recibido de (nombre de la red)": "author_name",
    "Name": "author_name",
    "Date": "comment_date",
    "Timestamp (ART)": "comment_date",
    "Message Type": "message_type",
    "Tipo de mensaje": "message_type",
    "Status": "reply_status",
    "Estado de respuesta": "reply_status"
}

# Strictly required for basic processing
REQUIRED_COLUMNS = ["ID de mensaje", "Message", "Recibido de (nombre de la red)", "Timestamp (ART)"] 
# We'll actually make this even more lenient in the code

def _normalize(text: str) -> str:
    """Lowercase and remove accents for accent-insensitive matching."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))

def classify_theme(text: str) -> str:
    t = _normalize(text)
    patterns = {
        "Inscripciones": [
            "anotar", "inscribir", "inscrip", "anoto", "admision", "matricula",
            "me anoto", "me inscribo", "quiero anotarme", "quiero inscribirme",
            "como me anoto", "como inscribirse", "como me inscribo",
            "proceso de inscripcion", "formulario", "registro", "registrar",
            "registrarme", "cuando abren", "cuando cierran", "plazo", "fecha limite",
            "vacantes", "cupo", "hay lugar", "me pueden anotar", "alta",
            "dar de alta", "como accedo al curso", "como entrar al curso",
            "quiero anotarme", "empezar el curso", "inicio del curso",
        ],
        "Soporte & Ayuda": [
            "ayuda", "soporte", "no carga", "no funciona", "error", "problema",
            "whatsapp", "contacto", "no puedo", "no me deja", "no me llega",
            "no encuentro", "no veo", "no aparece", "como hago", "como puedo",
            "donde esta", "donde encuentro", "contrasena", "password", "olvide",
            "acceso", "login", "ingresar", "no ingresa", "no me deja ingresar",
            "servicio tecnico", "asistencia", "tengo una duda", "me pueden ayudar",
            "necesito ayuda", "me pueden contactar", "necesito soporte",
            "no me funciona", "falla", "bug", "no abre", "se cayo",
        ],
        "Costos": [
            "precio", "cuanto sale", "valor", "cuota", "arancel", "descuento",
            "promo", "pagar", "costo", "cuanto cuesta", "cuanto vale", "tarifa",
            "inversion", "financiamiento", "cuotas", "plan de pago", "formas de pago",
            "efectivo", "transferencia", "debito", "credito", "tarjeta",
            "mercado pago", "mercadopago", "hay descuento", "tienen promocion",
            "beneficio", "beca", "subsidio", "gratuito", "gratis", "es gratis",
            "tiene costo", "cuanto es", "precio del curso", "valor del curso",
        ],
        "Feedback": [
            "gracias", "excelente", "muy bueno", "genial", "felicitaciones",
            "buena info", "increible", "fantastico", "perfecto", "impecable",
            "calidad", "recomendable", "util", "claro", "me gusto", "me encanto",
            "aprendi", "aprendi mucho", "muy claro", "muy util", "lo recomiendo",
            "buen trabajo", "muy profesional", "gracias por", "muchas gracias",
            "excelente contenido", "buen contenido", "muy completo",
            "muy bien explicado", "sigue asi", "los felicito", "5 estrellas",
            "10 puntos", "super bueno", "muy interesante", "de lujo",
        ],
    }

    for theme, keywords in patterns.items():
        if any(kw in t for kw in keywords):
            return theme
    return "Otros"

def clean_sprout_csv(file_path: str, dataset_id: int, session: Session):
    try:
        df = pd.read_csv(file_path)
        
        # Normalize network column values if they exist
        # Sprout Social uses "Twitter", but we use "X"
        for col in df.columns:
            if col in ["Network", "Red", "Inbox"]:
                df[col] = df[col].replace("Twitter", "X")
        
        # 1. Identify available mapped columns
        available_cols = df.columns.tolist()
        found_mapping = {k: v for k, v in COLUMN_MAPPING.items() if k in available_cols}
        
        # 2. Check for minimum functional data (Text + Date + ID/User)
        reverse_map = {v: k for k, v in found_mapping.items()}
        if 'comment_text' not in reverse_map.values() and 'Message' not in available_cols:
             return False, "CSV missing message/text column", 0, len(df)
        
        # 3. Filter and rename
        df = df[list(found_mapping.keys())].copy()
        df.rename(columns=found_mapping, inplace=True)

        # 4. Normalizing dates
        df['comment_date'] = pd.to_datetime(df['comment_date'], errors='coerce')

        # 5. Cleaning whitespace and empties
        # Handle NaN values for all string columns to avoid NOT NULL constraints
        string_cols = ['comment_text', 'author_name', 'account_name', 'network', 'message_type', 'reply_status', 'post_id', 'post_text', 'post_url', 'comment_id']
        for col in string_cols:
            if col in df.columns:
                df[col] = df[col].fillna("").astype(str).str.strip()
            else:
                df[col] = ""

        # Set specific defaults for critical fields if they are still empty
        df.loc[df['author_name'] == "", 'author_name'] = "Anonymous"
        df.loc[df['network'] == "", 'network'] = "Unknown"
        df.loc[df['message_type'] == "", 'message_type'] = "Comment"
        df.loc[df['reply_status'] == "", 'reply_status'] = "received"
        
        # Filters
        df = df[df['comment_text'] != ""]

        # 6. Remove duplicates
        if 'comment_id' in df.columns and not df['comment_id'].empty:
            # Ensure comment_id is not empty for drop_duplicates
            df.loc[df['comment_id'] == "", 'comment_id'] = [str(datetime.now().timestamp() + i/1000) for i in range(len(df[df['comment_id'] == ""]))]
            df.drop_duplicates(subset=['comment_id'], inplace=True)
        
        # 7. Convert to Comment objects and save
        comments = []
        for _, row in df.iterrows():
            text = row.get('comment_text', '')
            comment = Comment(
                dataset_id=dataset_id,
                network=row.get('network', 'Unknown'),
                account_name=row.get('account_name', 'Unknown'),
                post_id=str(row.get('post_id', '')),
                post_text=row.get('post_text', ''),
                post_url=row.get('post_url', ''),
                comment_id=str(row.get('comment_id', datetime.now().timestamp())),
                comment_text=text,
                author_name=row.get('author_name', 'Anonymous'),
                comment_date=row.get('comment_date', datetime.now()) if pd.notnull(row.get('comment_date')) else datetime.now(),
                message_type=row.get('message_type', 'Comment'),
                reply_status=row.get('reply_status', 'received'),
                theme=classify_theme(text)
            )
            comments.append(comment)
            session.add(comment)
        
        session.commit()
        return True, "Success", len(comments), 0

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        session.rollback()
        return False, str(e), 0, 0
def process_scraped_reviews(reviews: List[Dict], dataset_id: int, session: Session):
    try:
        comments = []
        for row in reviews:
            text = row.get('comment_text', '')
            # Try to parse date string if possible, otherwise use now
            # Google dates are relative ("2 days ago"), we'll just use current time for now
            # as parsing relative dates reliably is complex without extra libs.
            # But the Comment model requires a datetime.
            
            comment = Comment(
                dataset_id=dataset_id,
                network="Google",
                account_name=row.get('account_name', 'Google Maps'),
                post_id=row.get('post_id', ''),
                post_text="",
                post_url="",
                comment_id=row.get('comment_id', str(datetime.now().timestamp())),
                comment_text=text,
                author_name=row.get('author_name', 'Anonymous'),
                comment_date=datetime.now(), # Simplified
                message_type="Review",
                reply_status="received",
                theme=classify_theme(text)
            )
            comments.append(comment)
            session.add(comment)
        
        session.commit()
        return True, "Success", len(comments)
    except Exception as e:
        session.rollback()
        return False, str(e), 0

def process_chatbot_csv(file_path: str, dataset_id: int, session: Session):
    try:
        # User specified columns: session_id, actor, message, created_at
        df = pd.read_csv(file_path)
        
        required = ["session_id", "actor", "message", "created_at"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            return False, f"CSV is missing required columns: {', '.join(missing)}", 0, 0
        
        # Normalize and clean
        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
        df = df.dropna(subset=['message'])
        
        comments = []
        print(f"DEBUG: Processing chatbot CSV with {len(df)} rows")
        for i, row in df.iterrows():
            raw_text = str(row['message'])
            
            # Handle NaN/Empty actor
            actor = str(row['actor']) if pd.notnull(row['actor']) and str(row['actor']).lower() != "nan" else "Usuario"
            
            text = raw_text
            
            # Attempt to parse JSON if message looks like one
            if raw_text.strip().startswith(("[", "{")):
                try:
                    parsed = json.loads(raw_text)
                    if isinstance(parsed, list):
                        # Extract content from user messages
                        user_contents = [str(item.get("content", "")) for item in parsed if item.get("sender") == "user" and item.get("content")]
                        if user_contents:
                            text = " ".join(user_contents)
                        else:
                            # Fallback to any content if no "user" found
                            fallback_contents = [str(item.get("content", "")) for item in parsed if item.get("content")]
                            if fallback_contents:
                                text = " ".join(fallback_contents)
                    elif isinstance(parsed, dict):
                        text = str(parsed.get("content", raw_text))
                except Exception as e:
                    print(f"DEBUG: JSON parsing failed for row {i}: {e}")
                    text = raw_text

            # Final cleanup of text
            text = text.strip()
            if not text or text.lower() == "nan":
                text = "Sin contenido"

            comment = Comment(
                dataset_id=dataset_id,
                network="Chatbot",
                account_name="WhatsApp/Chatbot",
                session_id=str(row['session_id']),
                comment_id=f"cb_{row['session_id']}_{datetime.now().timestamp()}_{i}", 
                comment_text=text,
                author_name=actor,
                comment_date=row['created_at'] if pd.notnull(row['created_at']) else datetime.now(),
                message_type="Chatbot Message",
                reply_status="received",
                theme=classify_theme(text)
            )
            comments.append(comment)
            session.add(comment)
        
        session.commit()
        print(f"DEBUG: Successfully processed {len(comments)} comments")
        return True, "Chatbot data processed successfully", len(comments), 0
        
    except Exception as e:
        import traceback
        print(f"ERROR: process_chatbot_csv failed: {e}")
        traceback.print_exc()
        session.rollback()
        return False, str(e), 0, 0

def process_google_maps_txt(file_path: str, dataset_id: int, session: Session):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Split content into blocks based on "--- N. Autor (X estrellas) DATE ---"
        blocks = re.split(r'\n(?=--- \d+\. )', content)
        if len(blocks) == 1 and not blocks[0].startswith("---"):
             # Handle case where split didn't happen as expected (e.g. single review)
             if content.strip().startswith("---"):
                 blocks = [content.strip()]
             else:
                 return False, "Formato de archivo inválido", 0, 0
        
        comments_count = 0
        for block in blocks:
            if not block.strip():
                continue
                
            lines = block.strip().split('\n')
            header = lines[0]
            
            # Parse header: --- 1. Author Name (5 estrellas) 2 weeks ago ---
            match = re.search(r'--- \d+\. (.+?) \((\d+) estrellas\) (.*?) ---', header)
            if match:
                author_name = match.group(1)
                rating = int(match.group(2))
                # date_str = match.group(3)
            else:
                author_name = "Anonymous"
                rating = None

            # The rest of the block is text and optional owner reply
            text_lines = []
            owner_reply = None
            
            for line in lines[1:]:
                if "[Respuesta:]" in line:
                    owner_reply = line.split("[Respuesta:]")[-1].strip()
                else:
                    text_lines.append(line)
            
            comment_text = "\n".join(text_lines).strip()
            if not comment_text:
                comment_text = "(sin texto)"
            
            # Generate a more stable comment_id if possible, or just unique
            import hashlib
            block_hash = hashlib.md5(block.encode()).hexdigest()[:10]
            
            comment = Comment(
                dataset_id=dataset_id,
                network="google_maps",
                account_name="Google Maps",
                comment_id=f"gm_{dataset_id}_{block_hash}",
                comment_text=comment_text,
                author_name=author_name,
                comment_date=datetime.now(),
                message_type="Review",
                reply_status="received",
                rating=rating,
                owner_reply=owner_reply,
                theme=classify_theme(comment_text)
            )
            session.add(comment)
            comments_count += 1
            
        session.commit()
        return True, f"Se procesaron {comments_count} reseñas de Google Maps", comments_count, 0
    except Exception as e:
        import traceback
        print(f"ERROR processing google maps txt: {e}")
        traceback.print_exc()
        session.rollback()
        return False, str(e), 0, 0
