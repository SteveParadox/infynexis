"""Document parsers for various file types."""
from app.ingestion.parsers.base import DocumentParser, ParsedDocument
from app.ingestion.parsers.pdf import PDFParser
from app.ingestion.parsers.word import WordParser
from app.ingestion.parsers.text import TextParser

__all__ = [
    "DocumentParser",
    "ParsedDocument", 
    "PDFParser",
    "WordParser",
    "TextParser",
    "get_parser",
]


def get_parser(content_type: str) -> DocumentParser:
    """Get appropriate parser for content type.
    
    Args:
        content_type: MIME type of document
        
    Returns:
        Document parser instance
    """
    parsers = {
        "application/pdf": PDFParser(),
        "text/plain": TextParser(),
        "text/markdown": TextParser(),
        "text/x-markdown": TextParser(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": WordParser(),
        "application/msword": WordParser(),
    }
    
    parser = parsers.get(content_type)
    if not parser:
        # Default to text parser
        parser = TextParser()
    
    return parser
