from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

INK = (7, 9, 10, 255)
BLACK = (13, 16, 17, 255)
FABRIC = (24, 27, 27, 255)
FABRIC_HI = (48, 51, 49, 255)
STEEL = (93, 94, 87, 255)
STEEL_HI = (156, 151, 132, 255)
WARM = (219, 190, 132, 255)
EYE = (235, 216, 166, 255)


def px(draw, box, fill):
    draw.rectangle(box, fill=fill)


def texture(draw, box, light=(255, 255, 255, 12), dark=(0, 0, 0, 20), step=11):
    x0, y0, x1, y1 = box
    for i in range(72):
        x = x0 + 2 + (i * 37) % max(3, x1 - x0 - 4)
        y = y0 + 2 + (i * 53) % max(3, y1 - y0 - 4)
        color = light if i % 3 == 0 else dark
        draw.rectangle((x, y, x + (i % 2), y + (i % 3 == 0)), fill=color)


def player_sheet():
    sheet = Image.new("RGBA", (128, 192), (0, 0, 0, 0))
    directions = ("down", "left", "right", "up")
    for row, direction in enumerate(directions):
        for frame in range(4):
            ox, oy = frame * 32, row * 48
            d = ImageDraw.Draw(sheet)
            stride = (-2, 0, 2, 0)[frame]
            bob = (0, 1, 0, 1)[frame]
            # soft pixel shadow
            d.ellipse((ox + 6, oy + 39, ox + 26, oy + 45), fill=(0, 0, 0, 100))
            # legs and shoes
            d.polygon([(ox+11,oy+31),(ox+16,oy+31),(ox+15+stride,oy+42),(ox+9+stride,oy+42)], fill=(8,10,10,255))
            d.polygon([(ox+17,oy+31),(ox+22,oy+31),(ox+23-stride,oy+42),(ox+17-stride,oy+42)], fill=(14,16,16,255))
            px(d, (ox+7+stride,oy+41,ox+15+stride,oy+44), (4,5,5,255))
            px(d, (ox+18-stride,oy+41,ox+27-stride,oy+44), (4,5,5,255))
            # oversized coat silhouette
            coat = [(ox+11,oy+15+bob),(ox+6,oy+21+bob),(ox+4,oy+34),(ox+10,oy+38),(ox+16,oy+35),(ox+22,oy+38),(ox+28,oy+34),(ox+26,oy+21+bob),(ox+21,oy+15+bob)]
            d.polygon(coat, fill=(19,24,24,255), outline=INK)
            d.line((ox+16,oy+18+bob,ox+16,oy+35), fill=(61,67,64,150), width=1)
            d.line((ox+8,oy+24,ox+5,oy+34), fill=(39,45,43,255), width=2)
            d.line((ox+24,oy+24,ox+27,oy+34), fill=(8,11,11,255), width=2)
            # hood and pale visor
            d.ellipse((ox+9,oy+5+bob,ox+23,oy+20+bob), fill=(8,11,11,255), outline=INK)
            if direction == "up":
                d.arc((ox+10,oy+7+bob,ox+22,oy+19+bob), 185, 355, fill=(50,57,55,255), width=2)
            else:
                visor = [(ox+10,oy+10+bob),(ox+14,oy+7+bob),(ox+21,oy+9+bob),(ox+22,oy+14+bob),(ox+18,oy+17+bob),(ox+11,oy+15+bob)]
                d.polygon(visor, fill=(199,203,190,255), outline=(72,80,77,255))
                eye_x = ox + (13 if direction == "left" else 19 if direction == "right" else 17)
                px(d, (eye_x, oy+11+bob, eye_x+2, oy+12+bob), EYE)
    sheet.save(OUT / "player.png")


def product_sheet():
    sheet = Image.new("RGBA", (192, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(sheet)
    # black lace tee: rear sleeve -> body -> seams -> lace collar -> highlights
    d.ellipse((4,50,60,60), fill=(0,0,0,80))
    d.polygon([(15,15),(5,25),(12,36),(18,32),(17,56),(48,57),(47,32),(54,36),(61,25),(49,15)], fill=FABRIC, outline=INK)
    d.arc((21,10,43,27), 0, 180, fill=STEEL_HI, width=3)
    for x in range(24, 43, 5):
        d.line((x,16,x+5,22), fill=(105,100,88,180), width=1)
    d.line((24,29,21,52), fill=FABRIC_HI, width=2); d.line((39,29,44,53), fill=(8,10,10,255), width=2)
    px(d, (30,32,33,42), (108,94,75,255)); px(d, (27,36,29,39), (108,94,75,255)); px(d, (34,36,36,39), (108,94,75,255))
    # pants
    ox=64; d.ellipse((ox+5,51,ox+60,60), fill=(0,0,0,80))
    d.polygon([(ox+16,11),(ox+49,11),(ox+46,30),(ox+58,57),(ox+40,58),(ox+32,35),(ox+25,58),(ox+8,57),(ox+19,30)], fill=(21,24,24,255), outline=INK)
    d.line((ox+32,13,ox+32,36),fill=(76,79,75,180),width=2);d.line((ox+18,18,ox+47,18),fill=(91,89,82,160),width=1)
    d.line((ox+22,25,ox+15,53),fill=(48,52,49,200),width=2);d.line((ox+42,24,ox+51,54),fill=(5,7,7,220),width=2)
    # dark jacket
    ox=128; d.ellipse((ox+4,51,ox+61,60), fill=(0,0,0,80))
    d.polygon([(ox+18,14),(ox+8,21),(ox+3,47),(ox+16,50),(ox+19,34),(ox+18,58),(ox+48,58),(ox+46,34),(ox+50,50),(ox+62,47),(ox+57,21),(ox+47,14)], fill=(28,30,29,255), outline=INK)
    d.polygon([(ox+23,13),(ox+32,25),(ox+41,13),(ox+47,17),(ox+39,31),(ox+34,57),(ox+29,31),(ox+18,17)], fill=(20,22,22,255), outline=(63,65,61,255))
    d.line((ox+34,27,ox+34,55),fill=(126,117,96,180),width=1);px(d,(ox+37,35,ox+39,37),WARM)
    texture(d,(ox+10,18,ox+56,56))
    sheet.save(OUT / "products.png")
    sheet.crop((0, 0, 64, 64)).save(OUT / "black-lace-tee.png")
    sheet.crop((64, 0, 128, 64)).save(OUT / "black-pants.png")
    sheet.crop((128, 0, 192, 64)).save(OUT / "dark-jacket.png")


def cart_sheet():
    sheet = Image.new("RGBA", (320, 64), (0, 0, 0, 0))
    for frame, direction in enumerate(("down", "left", "right", "up")):
        d = ImageDraw.Draw(sheet); ox = frame * 80
        d.ellipse((ox+8,47,ox+72,60), fill=(0,0,0,95))
        if direction in ("left", "right"):
            flip = direction == "right"
            d.polygon([(ox+13,18),(ox+62,18),(ox+68,43),(ox+20,43)], fill=(19,22,21,255), outline=STEEL_HI)
            for x in range(23,64,9): d.line((ox+x,20,ox+x-3,41), fill=STEEL, width=1)
            for y in (25,33,41): d.line((ox+17,y,ox+66,y), fill=STEEL, width=1)
            # The cart stays in front of the player, so its handle must point
            # back toward the player in every cardinal movement frame.
            if flip:
                d.line((ox+16,18,ox+9,10,ox+3,10), fill=STEEL_HI, width=3)
            else:
                d.line((ox+64,18,ox+71,10,ox+77,10), fill=STEEL_HI, width=3)
            for x in (25,59): d.ellipse((ox+x,42,ox+x+8,50), fill=INK, outline=STEEL)
        else:
            wide_top = direction == "down"
            top_y, bottom_y = (13,46) if wide_top else (18,48)
            d.polygon([(ox+19,top_y),(ox+61,top_y),(ox+69,bottom_y),(ox+11,bottom_y)], fill=(19,22,21,255), outline=STEEL_HI)
            for x in range(20,63,9): d.line((ox+x,top_y+2,ox+x+(3 if wide_top else -3),bottom_y-2), fill=STEEL, width=1)
            for y in range(top_y+8,bottom_y,8): d.line((ox+15,y,ox+65,y), fill=STEEL, width=1)
            handle_y = 53 if direction == "up" else 7
            d.line((ox+20,handle_y,ox+60,handle_y), fill=STEEL_HI, width=3)
            for x in (18,56): d.ellipse((ox+x,46,ox+x+7,53), fill=INK, outline=STEEL)
    sheet.save(OUT / "cart-directions.png")


def furniture_sheet():
    img = Image.new("RGBA", (512, 512), (0,0,0,0)); d=ImageDraw.Draw(img)
    # Counter 256x128 at 0,0
    d.ellipse((12,100,244,125),fill=(0,0,0,90));d.polygon([(22,42),(226,42),(246,64),(232,113),(25,113),(8,68)],fill=(16,18,18,255),outline=INK)
    d.polygon([(8,68),(246,64),(232,86),(25,90)],fill=(54,51,44,255),outline=INK);d.line((31,96,225,92),fill=(92,78,58,180),width=2)
    for x in (55,102,150,198): d.line((x,90,x-2,110),fill=(36,36,33,255),width=2)
    # Pile 192x128 at 256,0
    d.ellipse((262,98,446,126),fill=(0,0,0,110))
    piles=[(270,76,330,111,FABRIC),(304,55,375,108,(31,31,29,255)),(350,70,430,112,(20,23,23,255)),(285,88,397,121,(14,16,16,255))]
    for box,color in [(p[:4],p[4]) for p in piles]: d.ellipse(box,fill=color,outline=INK)
    for i in range(14):
        x=273+(i*31)%150;y=62+(i*17)%49;d.arc((x,y,x+35,y+18),180,355,fill=(75,71,62,150),width=2)
    # Vending 96x128 at 0,128
    d.rectangle((10,132,84,252),fill=(19,23,23,255),outline=INK,width=3);d.rectangle((18,141,74,211),fill=(43,49,47,255),outline=(112,105,87,255))
    for row in range(3):
        for col in range(4):
            x=23+col*12;y=150+row*18;d.rectangle((x,y,x+7,y+12),fill=((92+col*15,80+row*15,60,255)),outline=INK)
    d.rectangle((22,220,69,238),fill=(8,10,10,255));px(d,(72,218,77,224),WARM)
    # CRT 64x96 at 96,128
    d.rectangle((100,146,156,205),fill=(39,39,35,255),outline=INK,width=3);d.rectangle((108,153,148,191),fill=(10,16,15,255),outline=(101,94,76,255))
    for y in range(157,189,5): d.line((111,y,145,y),fill=(122,116,92,45),width=1)
    d.polygon([(108,205),(148,205),(154,220),(102,220)],fill=(15,17,17,255),outline=INK);px(d,(144,196,148,200),WARM)
    # Rack 224x128 at 160,128
    d.line((170,150,374,150),fill=STEEL_HI,width=5);d.line((178,148,178,244),fill=STEEL,width=4);d.line((366,148,366,244),fill=STEEL,width=4)
    for i in range(8):
        x=183+i*22; color=(20+i%3*5,22+i%2*6,22+i%4*3,255)
        d.line((x,152,x+9,166,x+18,152),fill=(104,99,84,255),width=2)
        d.polygon([(x+3,164),(x-4,176),(x+1,224),(x+18,226),(x+23,176),(x+15,164)],fill=color,outline=INK)
        d.line((x+6,175,x+5,216),fill=(62,63,58,150),width=1)
    d.line((168,244,376,244),fill=(61,58,51,255),width=7)
    # table 192x112 at 0,256
    d.ellipse((7,337,187,366),fill=(0,0,0,90));d.polygon([(15,278),(170,270),(188,291),(27,305)],fill=(47,44,38,255),outline=INK)
    d.polygon([(27,305),(188,291),(182,326),(30,340)],fill=(18,20,20,255),outline=INK)
    for x,y in [(35,279),(72,282),(108,276),(143,280)]: d.rounded_rectangle((x,y,x+27,y+12),3,fill=FABRIC,outline=INK)
    d.line((38,335,35,359),fill=STEEL,width=4);d.line((174,324,177,353),fill=STEEL,width=4)
    # cart 80x64 at 192,256
    d.ellipse((194,305,268,321),fill=(0,0,0,95));d.line((198,273,258,273,264,303,203,303,198,273),fill=STEEL_HI,width=3)
    for x in range(205,260,10): d.line((x,276,x+3,300),fill=STEEL,width=1)
    for y in range(281,301,7): d.line((202,y,261,y),fill=STEEL,width=1)
    d.line((198,273,188,265,181,265),fill=STEEL_HI,width=4)
    for x in (210,253): d.ellipse((x,303,x+9,312),fill=INK,outline=STEEL)
    # door 80x128 at 272,256
    d.rectangle((278,260,346,379),fill=(16,18,18,255),outline=(68,62,51,255),width=4);d.rectangle((287,271,337,360),fill=(21,23,22,255),outline=INK)
    d.rectangle((294,286,331,306),fill=(9,11,11,255));px(d,(333,318,337,322),WARM)
    # AC 128x64 at 352,256
    d.rounded_rectangle((357,267,475,310),6,fill=(101,101,91,255),outline=INK,width=3);d.line((369,294,462,294),fill=(44,46,44,255),width=3)
    for x in range(371,464,9):d.line((x,296,x,304),fill=(55,57,54,255),width=1)
    # logo 128x80 at 0,368
    for x in (24,58,92): d.rounded_rectangle((x,378,x+12,434),5,fill=(220,211,182,255))
    d.ellipse((9,402,23,416),fill=(220,211,182,255));d.ellipse((105,391,117,403),fill=(220,211,182,255))
    # seller 64x96 at 128,368
    d.ellipse((132,445,190,462),fill=(0,0,0,90));d.polygon([(145,400),(135,420),(132,454),(188,454),(185,420),(175,400)],fill=(7,9,9,255),outline=INK)
    d.ellipse((145,376,177,411),fill=(5,7,7,255),outline=INK);px(d,(151,391,155,393),EYE);px(d,(168,391,172,393),EYE)
    # sewing machine 112x80 at 192,368
    d.rectangle((202,428,294,441),fill=(41,39,34,255),outline=INK);d.polygon([(216,385),(269,385),(282,400),(282,418),(256,418),(256,402),(228,402),(228,430),(210,430),(210,396)],fill=(135,131,116,255),outline=INK)
    d.ellipse((266,390,278,402),outline=(54,55,52,255),width=3);d.line((255,402,255,429),fill=INK,width=2);px(d,(248,425,260,429),STEEL_HI)
    # boxes and fabric 128x96 at 304,368
    d.rectangle((310,407,365,456),fill=(57,43,29,255),outline=INK);d.line((337,408,337,456),fill=(91,67,41,255),width=2)
    d.rectangle((361,421,424,466),fill=(45,34,25,255),outline=INK);d.ellipse((371,386,423,429),fill=FABRIC,outline=INK)
    texture(d,(312,410,422,464))
    img.save(OUT / "furniture.png")


def tiles_sheet():
    img=Image.new("RGBA",(128,64),(0,0,0,0));d=ImageDraw.Draw(img)
    d.rectangle((0,0,63,63),fill=(34,34,31,255))
    for x in range(0,65,32):d.line((x,0,x,64),fill=(19,20,19,255),width=2)
    for y in range(0,65,32):d.line((0,y,64,y),fill=(19,20,19,255),width=2)
    for i in range(25):
        x=(i*23)%60;y=(i*41)%60;px(d,(x,y,x+2,y+1),(70,66,55,55))
    d.rectangle((64,0,127,63),fill=(22,23,22,255))
    for y in range(8,64,16):d.line((64,y,128,y),fill=(42,40,35,255),width=2)
    for i in range(20):
        x=66+(i*29)%58;y=3+(i*17)%57;px(d,(x,y,x+1,y+3),(7,9,9,100))
    img.save(OUT / "tiles.png")


def level_preview():
    furniture = Image.open(OUT / "furniture.png").convert("RGBA")
    products = Image.open(OUT / "products.png").convert("RGBA")
    player = Image.open(OUT / "player.png").convert("RGBA")
    tiles = Image.open(OUT / "tiles.png").convert("RGBA")
    room = Image.new("RGBA", (1280, 768), (7, 9, 9, 255))
    wall_tile = tiles.crop((64, 0, 128, 64)); floor_tile = tiles.crop((0, 0, 64, 64))
    for y in range(26, 206, 64):
        for x in range(64, 1216, 64): room.alpha_composite(wall_tile, (x, y))
    for y in range(154, 718, 64):
        for x in range(64, 1216, 64): room.alpha_composite(floor_tile, (x, y))
    frames = {
        "counter": (0,0,256,128), "pile": (256,0,448,128), "vending": (0,128,96,256), "crt": (96,128,160,224),
        "rack": (160,128,384,256), "table": (0,256,192,368), "cart": (192,256,272,320), "door": (272,256,352,384),
        "ac": (352,256,480,320), "logo": (0,368,128,448), "seller": (128,368,192,464), "sewing": (192,368,304,448), "boxes": (304,368,432,464),
    }
    objects = [
        ("door",108,55,183),("logo",520,61,141),("ac",978,66,130),("vending",155,195,323),("crt",298,235,331),
        ("counter",682,178,304),("seller",778,161,258),("pile",994,222,345),("sewing",1035,204,285),
        ("rack",86,348,476),("table",438,365,477),("rack",824,493,621),("boxes",1052,493,590),
    ]
    queue = []
    for name, x, y, sort_y in objects:
        queue.append((sort_y, furniture.crop(frames[name]), x, y))
    for sprite, x, y, sort_y in ((0,231,410,465),(1,510,398,448),(2,914,548,603)):
        queue.append((sort_y, products.crop((sprite*64,0,sprite*64+64,64)),x,y))
    queue.append((650, player.crop((0,0,32,48)), 604, 608))
    queue.append((634, furniture.crop(frames["cart"]), 302, 590))
    for _, sprite, x, y in sorted(queue, key=lambda item: item[0]): room.alpha_composite(sprite, (x, y))
    overlay = Image.new("RGBA", room.size, (0,0,0,0)); od = ImageDraw.Draw(overlay)
    for x, y, radius in ((148,183,170),(590,151,210),(804,205,170),(1080,212,180)):
        for ring in range(radius, 0, -12):
            alpha = int(1.5 * (1 - ring / radius))
            od.ellipse((x-ring,y-ring,x+ring,y+ring), fill=(230,195,135,alpha))
    room = Image.alpha_composite(room, overlay)
    room.save(OUT / "level-preview.png")


if __name__ == "__main__":
    player_sheet()
    product_sheet()
    cart_sheet()
    furniture_sheet()
    tiles_sheet()
    level_preview()
    print(f"Generated showroom sprites in {OUT}")
