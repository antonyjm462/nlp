from flask import Flask, request, jsonify, send_from_directory
from meilisearch import Client
from dotenv import load_dotenv
from flask_cors import CORS
import os
import json

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__, static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize MeiliSearch client
MEILISEARCH_URL = os.getenv('MEILISEARCH_URL')
MEILI_MASTER_KEY = os.getenv('MEILI_MASTER_KEY')
print(f"🚀 Connecting to MeiliSearch at {MEILISEARCH_URL}", flush=True)

client = Client(MEILISEARCH_URL, MEILI_MASTER_KEY)

def check_index_exists():
    """Check if index exists and has documents"""
    try:
        # Get list of all indexes
        indexes = client.get_indexes()
        
        # Check if videos index exists
        videos_index = None
        for index in indexes:
            if index.uid == 'videos':
                videos_index = index
                break
        
        if not videos_index:
            print("ℹ️ Videos index does not exist", flush=True)
            return False
            
        # Get index stats
        stats = videos_index.get_stats()
        doc_count = stats.get('numberOfDocuments', 0)
        
        if doc_count == 0:
            print("ℹ️ Videos index exists but has no documents", flush=True)
            return False
            
        print(f"ℹ️ Videos index exists with {doc_count} documents", flush=True)
        return True
        
    except Exception as e:
        print(f"ℹ️ Error checking index: {str(e)}", flush=True)
        return False

def index_documents():
    """Index all JSON files from json_output folder"""
    try:
        print("🔍 Checking index status...", flush=True)

        # Check if documents are already indexed
        if check_index_exists():
            print("✅ Documents already indexed. Skipping indexing.", flush=True)
            return -1  # Return -1 to indicate no indexing was needed

        print("📝 Starting indexing process...", flush=True)

        json_folder = 'json_output'
        if not os.path.exists(json_folder):
            print("❌ json_output folder does not exist.", flush=True)
            return 0

        # Create new index with explicit primary key
        client.create_index('videos', {'primaryKey': 'video_id'})
        print("✨ Created new index with primary key 'video_id'", flush=True)

        # Get the index object
        index = client.index('videos')
        print("📑 Got index object", flush=True)

        documents = []
        for filename in os.listdir(json_folder):
            if filename.endswith('.json'):
                with open(os.path.join(json_folder, filename), 'r', encoding='utf-8') as f:
                    try:
                        doc = json.load(f)
                        if isinstance(doc, dict) and 'video_id' in doc:
                            documents.append(doc)
                        else:
                            print(f"⚠️ Skipping {filename}: Missing video_id or invalid format", flush=True)
                    except json.JSONDecodeError:
                        print(f"⚠️ Error parsing {filename}: Invalid JSON", flush=True)

        if not documents:
            print("⚠️ No valid JSON documents found.", flush=True)
            return 0

        # Add documents to index
        for doc in documents:
            response = index.add_documents(doc)
            print(f"✅ Indexed response {response}.", flush=True)
        print(f"✅ Indexed {len(documents)} documents.", flush=True)
        return len(documents)

    except Exception as e:
        print(f"❌ Error during indexing: {str(e)}", flush=True)
        raise

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/search')
def search():
    query = request.args.get('q', '').strip()
    if not query:
        try:
            # For empty queries, return all documents
            index = client.index('videos')
            results = index.search(query, {'limit': 100})  # Increase limit for initial load
            return jsonify(results)
        except Exception as e:
            print(f"❌ Error fetching all documents: {str(e)}", flush=True)
            return jsonify({'error': str(e)}), 500
    
    try:
        index = client.index('videos')
        results = index.search(query)
        return jsonify(results)
    except Exception as e:
        print(f"❌ Search error: {str(e)}", flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/reindex')
def reindex():
    try:
        doc_count = index_documents()
        if doc_count == -1:
            return jsonify({'message': 'Documents already indexed. No reindexing needed.'})
        return jsonify({'message': f'Successfully indexed {doc_count} documents'})
    except Exception as e:
        print(f"❌ Reindexing error: {str(e)}", flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/video/<video_id>')
def video_page(video_id):
    try:
        # Search for the specific video
        index = client.index('videos')
        results = index.search(video_id, {'limit': 1})
        
        if not results['hits']:
            return "Video not found", 404
            
        return send_from_directory(app.static_folder, 'video.html')
    except Exception as e:
        print(f"❌ Error fetching video: {str(e)}", flush=True)
        return str(e), 500

def init_app():
    print("🚀 Initializing application...", flush=True)
    try:
        doc_count = index_documents()
        if doc_count == -1:
            print("✅ Documents already indexed. No initialization needed.", flush=True)
        else:
            print(f"✅ Initial indexing complete: {doc_count} documents indexed", flush=True)
    except Exception as e:
        print(f"❌ Initialization error: {str(e)}", flush=True)
    return app

if __name__ == '__main__':
    app = init_app()
    app.run(debug=True)