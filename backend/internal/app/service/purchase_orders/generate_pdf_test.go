package purchaseorders

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
)

func TestPOPDFItemRowHeightExpandsForWrappedProductNames(t *testing.T) {
	document := pdf.NewMaroto(consts.Portrait, consts.A4)
	document.SetPageMargins(10, 15, 10)
	document.AddUTF8Font("THSarabun", consts.Normal, filepath.Join("..", "..", "..", "..", "assets", "fonts", "THSarabunNew.ttf"))
	document.SetDefaultFontFamily("THSarabun")

	shortHeight := poPDFItemRowHeight(document, "Oil filter", 4)
	longName := strings.Repeat("Premium oil filter assembly ", 8)
	wideHeight := poPDFItemRowHeight(document, longName, 4)
	narrowHeight := poPDFItemRowHeight(document, longName, 2)

	if shortHeight != poPDFItemBaseRowHeight {
		t.Fatalf("short product row height = %.1f, want %.1f", shortHeight, poPDFItemBaseRowHeight)
	}
	if wideHeight <= shortHeight {
		t.Fatalf("long product row height = %.1f, want greater than %.1f", wideHeight, shortHeight)
	}
	if narrowHeight <= wideHeight {
		t.Fatalf("narrow product column row height = %.1f, want greater than %.1f", narrowHeight, wideHeight)
	}
}
