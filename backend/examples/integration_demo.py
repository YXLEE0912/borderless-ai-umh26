"""
Example: Using the Enhanced Scanner with Trade Policy Context

This example shows how the scanner now combines image analysis 
with Malaysian trade policy data for better compliance insights.
"""

import asyncio
from app.core.config import Settings
from app.core.supabase import build_supabase_client
from app.services.scanner import ProductScanner
from app.services.rules_enrichment import RulesEnrichmentService


async def example_1_basic_enrichment():
    """Example: Basic image + trade policy analysis"""
    
    # Setup
    settings = Settings()
    supabase_client = build_supabase_client(settings)
    scanner = ProductScanner(settings=settings, supabase_client=supabase_client)
    
    # User uploads a leather jacket image
    with open("sample_leather_jacket.jpg", "rb") as f:
        image_bytes = f.read()
    
    # Analyze
    result = await scanner.analyze(
        prompt="I need to export this leather jacket to Vietnam. What are the requirements?",
        destination_country="Vietnam",
        image_bytes=image_bytes,
        image_content_type="image/jpeg",
        image_filename="leather_jacket.jpg"
    )
    
    # Result now includes:
    # - Product name from image (Leather Jacket)
    # - Materials detected (genuine leather, synthetic lining)
    # - HS code candidates with high confidence
    # - Compliance status (green/conditional/restricted)
    # - Required documents & permits
    # - Vietnamese-specific requirements
    # - References to Malaysian trade policies
    
    print(f"Product: {result.product_name}")
    print(f"Status: {result.status}")
    print(f"Materials: {result.materials_detected}")
    print(f"HS Code: {result.hs_code_candidates}")
    print(f"Requirements: {result.required_documents}")
    print(f"Compliance: {result.compliance_summary}")


async def example_2_manual_policy_search():
    """Example: Search for specific trade policies"""
    
    settings = Settings()
    supabase_client = build_supabase_client(settings)
    enrichment = RulesEnrichmentService(supabase_client=supabase_client)
    
    # Search for leather export rules
    leather_context = await enrichment.search_policies(
        query="leather export requirements Malaysia",
        limit=3
    )
    
    if leather_context:
        print("Found relevant policies:")
        print(leather_context)
    else:
        print("No policies found. Make sure supaTrade.py has run to populate Supabase.")


async def example_3_what_gets_sent_to_ai():
    """Example: See exactly what prompt the AI model receives"""
    
    settings = Settings()
    supabase_client = build_supabase_client(settings)
    enrichment = RulesEnrichmentService(supabase_client=supabase_client)
    
    # Simulate detected materials from image
    materials = ["genuine leather", "synthetic lining", "metal buckles"]
    product = "Leather Jacket"
    destination = "Vietnam"
    
    # Get enriched context
    context = await enrichment.get_relevant_context(
        materials=materials,
        product_name=product,
        destination_country=destination
    )
    
    # Build prompt as scanner would
    original_prompt = f"Is this {product} exportable to {destination}?"
    
    vision_info = f"""[Image Analysis from Gemini Vision]
Product name (from image): {product}
Materials detected: {", ".join(materials)}"""
    
    full_prompt = f"""{original_prompt}

{vision_info}

{context or '(No trade policy context found)'}"""
    
    print("=" * 80)
    print("PROMPT SENT TO ILMU (Z.ai) MODEL:")
    print("=" * 80)
    print(full_prompt)
    print("=" * 80)


async def example_4_different_scenarios():
    """Example: Different products show different enrichment"""
    
    settings = Settings()
    supabase_client = build_supabase_client(settings)
    enrichment = RulesEnrichmentService(supabase_client=supabase_client)
    
    scenarios = [
        {
            "name": "Electronics",
            "materials": ["semiconductor", "copper", "plastic"],
            "product": "Mobile Phone"
        },
        {
            "name": "Food Products", 
            "materials": ["cocoa", "sugar", "food-grade packaging"],
            "product": "Chocolate"
        },
        {
            "name": "Textiles",
            "materials": ["cotton", "polyester", "silk"],
            "product": "T-Shirt"
        }
    ]
    
    for scenario in scenarios:
        print(f"\n📦 {scenario['name']}")
        print("-" * 40)
        
        context = await enrichment.get_relevant_context(
            materials=scenario["materials"],
            product_name=scenario["product"],
            destination_country="Singapore"
        )
        
        if context:
            print(context[:300] + "...")
        else:
            print("(No matching policies found)")


# ============================================================================
# HOW TO RUN THESE EXAMPLES
# ============================================================================
# 
# 1. Make sure supaTrade.py has been run to populate Supabase with content:
#    $ cd scraping/scraping
#    $ python supaTrade.py
#
# 2. Run this file from the backend directory:
#    $ python examples/integration_demo.py
#
# 3. Try individual examples:
#    $ python -c "from examples.integration_demo import *; asyncio.run(example_1_basic_enrichment())"
#
# ============================================================================


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        example_num = int(sys.argv[1])
        if example_num == 1:
            asyncio.run(example_1_basic_enrichment())
        elif example_num == 2:
            asyncio.run(example_2_manual_policy_search())
        elif example_num == 3:
            asyncio.run(example_3_what_gets_sent_to_ai())
        elif example_num == 4:
            asyncio.run(example_4_different_scenarios())
    else:
        print("Usage: python integration_demo.py [1|2|3|4]")
        print("\nAvailable examples:")
        print("  1 - Basic enrichment (image + trade context)")
        print("  2 - Manual policy search")
        print("  3 - See full prompt sent to AI")
        print("  4 - Different product scenarios")
