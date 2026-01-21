
def validate_iban(iban: str) -> bool:
    """
    Validates IBAN using Mod97 algorithm.
    Spaces and dashes are ignored.
    """
    if not iban:
        return False
        
    iban = iban.replace(' ', '').replace('-', '').upper()
    
    # Generic length check (ES is 24, generic 15-34)
    if len(iban) < 15 or len(iban) > 34:
        return False

    # Move first 4 chars to end
    rearranged = iban[4:] + iban[:4]
    
    # Replace letters with numbers (A=10, B=11, ..., Z=35)
    numeric_string = ""
    for char in rearranged:
        if char.isdigit():
            numeric_string += char
        else:
            numeric_string += str(ord(char) - 55)
            
    # Check Mod97
    try:
        return int(numeric_string) % 97 == 1
    except:
        return False

def validate_spanish_cif(cif: str) -> bool:
    """
    Validates Spanish NIF/CIF/NIE checksum.
    Returns True if valid, False otherwise.
    """
    cif = cif.upper().strip().replace('-', '') if cif else ""
    if not cif or len(cif) != 9:
        return False

    # Check NIF/NIE vs CIF by first char
    first = cif[0]
    
    # NIE: X, Y, Z -> 0, 1, 2
    if first in 'XYZ':
        prefix = {'X':'0', 'Y':'1', 'Z':'2'}[first]
        temp_nif = prefix + cif[1:]
        if not temp_nif[:-1].isdigit(): return False
        
        control_map = "TRWAGMYFPDXBNJZSQVHLCKE"
        try:
            mod = int(temp_nif[:-1]) % 23
            return control_map[mod] == cif[-1]
        except:
            return False

    # NIF (Standard DNI): 8 digits + 1 letter
    if first.isdigit():
        if not cif[:-1].isdigit(): return False
        control_map = "TRWAGMYFPDXBNJZSQVHLCKE"
        try:
            mod = int(cif[:-1]) % 23
            return control_map[mod] == cif[-1]
        except:
            return False

    # CIF (Company): Letter + 7 digits + Control
    # Organizations
    ORG_TYPES = "ABCDEFGHJNPQRSUVW"
    if first in ORG_TYPES:
        digits = cif[1:8]
        if not digits.isdigit(): return False
        
        a = 0
        b = 0
        for i, digit_char in enumerate(digits):
            digit = int(digit_char)
            # Positions (1-based in standard): 
            # Odd positions (1, 3, 5, 7) -> Logic: 2*d
            # Even positions (2, 4, 6) -> Logic: sum
            # In 0-index loop: 0 is Odd, 1 is Even...
            
            if i % 2 == 1: # Even position
                a += digit
            else: # Odd position
                aux = digit * 2
                b += (aux // 10) + (aux % 10)
        
        partial_sum = a + b
        units = partial_sum % 10
        control_digit = (10 - units) if units != 0 else 0
        
        control_map_cif = "JABCDEFGHI" # For numeric result (0=J, 1=A...) <- wait, usually numeric for A,B,E,H
        
        # Determine expected type
        is_numeric_control = first in "ABEH"
        is_letter_control = first in "KPQS"
        # Others can be both? Defaulting to mixed check.
        
        last = cif[8]
        
        # Check numeric match
        if last.isdigit():
            return int(last) == control_digit
        else:
            # Check letter match
            # Map: 1=A, 2=B... 10/0 = J
            expected_letter = control_map_cif[control_digit]
            return last == expected_letter
            
    return False # Unknown format
